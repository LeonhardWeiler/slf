package websocket

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
)

// writeTimeout bounds a single message write. Without it a slow or dead client
// (TCP backpressure) would stall the whole broadcast loop for everyone.
const writeTimeout = 5 * time.Second

// maxMessageBytes caps a single inbound WebSocket message (64 KiB).
const maxMessageBytes = 1 << 16

// Per-connection message rate limit (token bucket). Deliberately generous: a
// normal client peaks around a handful of messages per second (debounced answer
// updates, occasional actions), so it never hits this — but a flooding client is
// capped so it can't monopolise the single hub mutex. Over-limit messages are
// dropped, not processed.
const (
	rateBurst  = 120.0 // bucket capacity
	rateRefill = 40.0  // tokens added per second
)

// envAllowedOrigins is an optional explicit allow-list read once from
// WS_ALLOWED_ORIGINS (comma-separated "host" or "host:port"). It is only needed
// for origins that are neither same-origin nor local — e.g. a frontend hosted on
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
//   - No Origin header (native clients, tests) → allowed; CSWSH is browser-only.
//   - Same-origin (Origin host == request Host) → allowed. This makes the
//     single-image deploy work identically on localhost, a LAN IP or a domain.
//   - localhost / loopback / private-LAN IPs (any port) → allowed, so the Vite
//     dev server (also when reached via the machine's LAN IP, e.g. mobile
//     testing) can connect cross-origin.
//   - Anything else (e.g. a public attacker site) → rejected, unless explicitly
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
	conn      *websocket.Conn
	hub       *Hub
	sessionID string

	// Rate-limit state, only ever touched from this client's single read loop,
	// so it needs no synchronisation.
	rlTokens float64
	rlLast   time.Time
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
		InsecureSkipVerify: true,
	})
	if err != nil {
		return
	}
	// Cap a single inbound message. Set explicitly (rather than relying on the
	// library default) so the bound is intentional and version-stable. 64 KiB is
	// ample for the largest client message (an inputSync of all answers).
	conn.SetReadLimit(maxMessageBytes)

	c := &Client{conn: conn, hub: hub}
	hub.addPending(c)
	defer hub.onDisconnect(c)

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

		handleMessage(c.hub, c, msg)
	}
}

func (c *Client) send(msgType string, payload any) error {
	return c.sendV(msgType, payload, 0)
}

// sendV sends a message tagged with a specific stateVersion (SRS 9.15.2).
func (c *Client) sendV(msgType string, payload any, version int) error {
	b, err := json.Marshal(OutboundMessage{Type: msgType, Payload: payload, StateVersion: version})
	if err != nil {
		return err
	}
	return c.writeRaw(b)
}

func (c *Client) writeRaw(b []byte) error {
	ctx, cancel := context.WithTimeout(context.Background(), writeTimeout)
	defer cancel()
	err := c.conn.Write(ctx, websocket.MessageText, b)
	if err != nil {
		// A failed/timed-out write leaves the connection unusable — close it so
		// the read loop unblocks and onDisconnect cleans up, instead of letting a
		// stuck client block future broadcasts.
		_ = c.conn.Close(websocket.StatusInternalError, "write failed")
	}
	return err
}
