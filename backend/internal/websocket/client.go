package websocket

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/coder/websocket"
)

// writeTimeout bounds a single message write. Without it a slow or dead client
// (TCP backpressure) would stall the whole broadcast loop for everyone.
const writeTimeout = 5 * time.Second

type Client struct {
	conn      *websocket.Conn
	hub       *Hub
	sessionID string
}

func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"},
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
