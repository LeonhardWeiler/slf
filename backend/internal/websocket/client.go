package websocket

import (
	"context"
	"encoding/json"
	"github.com/coder/websocket"
	"net/http"
)

type Client struct {
	conn *websocket.Conn
	hub  *Hub
	id string
	roomCode string
}

type Message struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"},
	})
	if err != nil {
		println("accept error:", err.Error())
		return
	}

	println("WS CONNECTED")

	client := &Client{
		conn: conn,
		hub:  hub,
		id:   generateID(),
	}

	hub.register <- client

	go client.Read(hub)
}

func (c *Client) Read(hub *Hub) {
	for {
		_, msg, err := c.conn.Read(context.Background())
		if err != nil {
			return
		}

		var m Message
		json.Unmarshal(msg, &m)

		switch m.Event {

		case "create_lobby":
			handleCreateLobby(hub, c, m.Data)
		}
	}
}

type OutgoingMessage struct {
	Event string `json:"event"`
	Data  any    `json:"data"`
}

func (c *Client) Send(event string, data any) error {
	msg := OutgoingMessage{
		Event: event,
		Data:  data,
	}

	b, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	return c.conn.Write(
		context.Background(),
		websocket.MessageText,
		b,
	)
}
