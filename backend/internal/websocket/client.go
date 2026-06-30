package websocket

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/coder/websocket"
)

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
	b, err := json.Marshal(OutboundMessage{Type: msgType, Payload: payload})
	if err != nil {
		return err
	}
	return c.conn.Write(context.Background(), websocket.MessageText, b)
}

func (c *Client) writeRaw(b []byte) error {
	return c.conn.Write(context.Background(), websocket.MessageText, b)
}
