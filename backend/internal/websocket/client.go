package websocket

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/url"
	"os"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
)

// writeTimeout bounds a single write of a client's writer goroutine. Sized for
// a full lobby state over EDGE (radio wake-up, retransmits), so a slow but live
// phone is not kicked into a reconnect loop.
const writeTimeout = 15 * time.Second

// sendQueueSize caps the messages waiting for one client. A client that falls
// this far behind is closed; it reconnects and gets a fresh snapshot.
const sendQueueSize = 64

// statusReplaced closes a socket whose session moved to a newer one (another
// tab); the client pauses instead of reconnecting.
const statusReplaced websocket.StatusCode = 4000

// snapshots are message types that carry a full state, so only the newest
// queued one of each has to reach the client.
var snapshots = map[string]bool{
	"lobbyState": true, "gameState": true, "reviewState": true, "commentatorState": true,
}

// pingInterval spaces the heartbeat; a ping unanswered for as long closes the
// connection, so a half-open socket (mobile NAT drop) reaches onDisconnect and
// the client its reconnect path.
const pingInterval = 25 * time.Second

// maxMessageBytes caps a single inbound WebSocket message (64 KiB).
const maxMessageBytes = 1 << 16

// Per-connection message rate limit (token bucket). Deliberately generous: a
// normal client peaks around a handful of messages per second (debounced answer
// updates, occasional actions), so it never hits this - but a flooding client is
// capped so it can't monopolise the single hub mutex. Over-limit messages are
// dropped, not processed.
const (
	rateBurst  = 120.0 // bucket capacity
	rateRefill = 40.0  // tokens added per second
)

// Backoff for joins and lobby creation: after a few free tries, consecutive
// failed joins (wrong/unknown code) and every further seat (create or join) on one
// connection must be spaced out by a growing delay. Gentle on purpose -
// legitimate users rarely hit it - while slowing code guessing and stopping
// one socket from walking the global maxLobbies cap.
const (
	backoffFree = 5               // attempts allowed before any throttling
	backoffStep = 1 * time.Second // added delay per extra attempt
	backoffMax  = 15 * time.Second
)

// envAllowedOrigins is an optional explicit allow-list read once from
// WS_ALLOWED_ORIGINS (comma-separated "host" or "host:port"). It is only needed
// for origins that are neither same-origin nor local - e.g. a frontend hosted on
// a different domain than the API. Entries are matched against the request
// Origin's host (with and without port), case-insensitively.
var envAllowedOrigins = sync.OnceValue(func() map[string]bool {
	out := map[string]bool{}
	for _, p := range strings.Split(os.Getenv("WS_ALLOWED_ORIGINS"), ",") {
		if p = strings.ToLower(strings.TrimSpace(p)); p != "" {
			out[p] = true
		}
	}
	return out
})

// originAllowed decides whether a WebSocket handshake may proceed, based on its
// Origin header. Secure by default and zero-config:
//   - No Origin header (native clients, tests) -> allowed; CSWSH is browser-only.
//   - Same-origin (Origin host == request Host) -> allowed. This makes the
//     single-image deploy work identically on localhost, a LAN IP or a domain.
//   - localhost / loopback / private-LAN IPs (any port) -> allowed, so the Vite
//     dev server (also when reached via the machine's LAN IP, e.g. mobile
//     testing) can connect cross-origin.
//   - Anything else (e.g. a public attacker site) -> rejected, unless explicitly
//     listed in WS_ALLOWED_ORIGINS.
//
// net.ParseIP is used rather than glob patterns so a look-alike host such as
// "192.168.evil.com" cannot slip through a "192.168.*" wildcard.
func originAllowed(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil || u.Host == "" {
		return false
	}
	if strings.EqualFold(u.Host, r.Host) {
		return true
	}
	if envAllowedOrigins()[strings.ToLower(u.Host)] {
		return true
	}
	host := strings.ToLower(u.Hostname())
	if envAllowedOrigins()[host] {
		return true
	}
	if host == "localhost" {
		return true
	}
	if ip := net.ParseIP(host); ip != nil && (ip.IsLoopback() || ip.IsPrivate()) {
		return true
	}
	return false
}

type Client struct {
	conn *websocket.Conn
	hub  *Hub
	// sessionID is guarded by Hub.mu. It is not only touched by this client's own
	// read loop: closeLobby and handleKickPlayer clear it on *other* clients, so
	// every read and write has to happen under the hub mutex the handlers already
	// hold. Assigning it after unlocking left it formally unsynchronised, ordered
	// only by whatever the following socket write happened to do.
	sessionID string
	// lobbyBase is the sessionID under which this client got its last full
	// lobbyState; while it matches, lobby changes go out as lobbyPatch.
	// Guarded by Hub.mu.
	lobbyBase string
	// tracked holds the track kinds this client already sent, per round.
	// Guarded by Hub.mu.
	tracked map[string]bool

	// Outbound messages, written in order by writeLoop. Enqueueing never blocks,
	// so a broadcast under hub.mu does no I/O.
	qmu   sync.Mutex
	queue []outMsg
	wake  chan struct{}

	// Rate-limit state, only ever touched from this client's single read loop,
	// so it needs no synchronisation.
	rlTokens float64
	rlLast   time.Time

	// Throttling state (also read-loop-only): consecutive failed joins, seats
	// taken by create or join, and the time of the last attempt of each.
	joinFails  int
	lastJoinAt time.Time
	seats      int
	lastSeatAt time.Time
}

// backoff returns how long a client must wait between attempts after n
// counted ones.
func backoff(n int) time.Duration {
	if n < backoffFree {
		return 0
	}
	return min(time.Duration(n-backoffFree+1)*backoffStep, backoffMax)
}

// allow consumes one token from the client's rate-limit bucket, refilling it
// based on elapsed time. Returns false when the bucket is empty (message should
// be dropped). Must only be called from the read loop.
func (c *Client) allow() bool {
	now := time.Now()
	if c.rlLast.IsZero() {
		c.rlLast = now
		c.rlTokens = rateBurst
	}
	c.rlTokens = min(c.rlTokens+now.Sub(c.rlLast).Seconds()*rateRefill, rateBurst)
	c.rlLast = now
	if c.rlTokens < 1 {
		return false
	}
	c.rlTokens--
	return true
}

func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	// Reject cross-site origins ourselves (CSWSH protection), then skip the
	// library's own origin check since originAllowed already covers it.
	if !originAllowed(r) {
		http.Error(w, "forbidden origin", http.StatusForbidden)
		return
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify:   true,
		CompressionMode:      websocket.CompressionNoContextTakeover,
		CompressionThreshold: 1024,
	})
	if err != nil {
		return
	}
	// Cap a single inbound message. Set explicitly (rather than relying on the
	// library default) so the bound is intentional and version-stable. 64 KiB is
	// ample for the largest client message (an inputSync of all answers).
	conn.SetReadLimit(maxMessageBytes)

	c := &Client{conn: conn, hub: hub, wake: make(chan struct{}, 1)}
	if !hub.addPending(c) {
		_ = conn.Close(websocket.StatusTryAgainLater, "server busy")
		return
	}
	defer hub.onDisconnect(c)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go c.writeLoop(ctx)
	go func() {
		t := time.NewTicker(hub.pingInterval)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
			}
			pctx, pcancel := context.WithTimeout(ctx, hub.pingInterval)
			err := conn.Ping(pctx)
			pcancel()
			if err != nil {
				_ = conn.Close(websocket.StatusGoingAway, "ping timeout")
				return
			}
		}
	}()

	c.read()
}

func (c *Client) read() {
	for {
		_, raw, err := c.conn.Read(context.Background())
		if err != nil {
			return
		}

		// Drop (ignore) messages beyond the rate limit before doing any work.
		if !c.allow() {
			continue
		}

		var msg InboundMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			continue
		}

		if c.hub.closed.Load() {
			return
		}
		handleMessage(c.hub, c, msg)
	}
}

func (c *Client) send(msgType string, payload any) {
	c.sendV(msgType, payload, 0)
}

// sendV sends a message tagged with a specific stateVersion (SRS 9.15.2).
func (c *Client) sendV(msgType string, payload any, version int) {
	b, _ := json.Marshal(OutboundMessage{Type: msgType, Payload: payload, StateVersion: version})
	c.enqueue(msgType, b)
}

// closeGoingAway sends a clean 1001 close so the client knows the server is
// shutting down (and can reconnect with backoff) instead of just seeing the
// socket drop. Used during graceful shutdown.
func (c *Client) closeGoingAway() {
	_ = c.conn.Close(websocket.StatusGoingAway, "server shutdown")
}

type outMsg struct {
	typ string
	b   []byte
}

// enqueue hands a marshalled message to writeLoop without blocking. A queued
// snapshot of the same type is superseded. A full queue closes the client.
func (c *Client) enqueue(typ string, b []byte) {
	c.qmu.Lock()
	if snapshots[typ] {
		c.queue = slices.DeleteFunc(c.queue, func(m outMsg) bool { return m.typ == typ })
	}
	full := len(c.queue) >= sendQueueSize
	if !full {
		c.queue = append(c.queue, outMsg{typ, b})
	}
	c.qmu.Unlock()
	if full {
		_ = c.conn.CloseNow()
		return
	}
	select {
	case c.wake <- struct{}{}:
	default:
	}
}

// writeLoop writes queued messages in order until ctx ends or a write fails.
func (c *Client) writeLoop(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-c.wake:
		}
		c.qmu.Lock()
		q := c.queue
		c.queue = nil
		c.qmu.Unlock()
		for _, m := range q {
			wctx, cancel := context.WithTimeout(ctx, writeTimeout)
			err := c.conn.Write(wctx, websocket.MessageText, m.b)
			cancel()
			if err != nil {
				_ = c.conn.CloseNow()
				return
			}
		}
	}
}
