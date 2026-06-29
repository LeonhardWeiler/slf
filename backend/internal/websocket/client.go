package websocket

import (
	"net/http"

	"github.com/coder/websocket"
)

type Client struct {
	conn *websocket.Conn
}

func ServeWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, nil)
	if err != nil {
		return
	}

	client := &Client{
		conn: conn,
	}

	hub.register <- client
}
