package websocket

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
)

// writeTimeout bounds a single message write. Without it a slow or dead client
// (TCP backpressure) would stall the whole broadcast loop for everyone.
const writeTimeout = 5 * time.Second

// Per-connection message rate limit (token bucket). Deliberately generous: a
// normal client peaks around a handful of messages per second (debounced answer
// updates, occasional actions), so it never hits this — but a flooding client is
// capped so it can't monopolise the single hub mutex. Over-limit messages are
// dropped, not processed.
const (
	rateBurst  = 120.0 // bucket capacity
	rateRefill = 40.0  // tokens added per second
)

// allowedOriginPatterns returns the WebSocket Origin allow-list, read once from
// WS_ALLOWED_ORIGINS (comma-separated hostname patterns, coder/websocket syntax).
// Same-origin requests are always accepted regardless. The default "*" keeps
// LAN/dev usage working out of the box; set the env var to lock it down for a
// public deployment (CSWSH hardening).
var allowedOriginPatterns = sync.OnceValue(func() []string {
	out := make([]string, 0)
	for _, p := range strings.Split(os.Getenv("WS_ALLOWED_ORIGINS"), ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	if len(out) == 0 {
		return []string{"*"}
	}
	return out
})

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
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: allowedOriginPatterns(),
	})
	if err != nil {
		return
	}

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
