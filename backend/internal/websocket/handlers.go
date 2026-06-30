package websocket

import (
	"context"
	"encoding/json"

	"github.com/coder/websocket"
	"slf/internal/game"
)

func handleCreateLobby(hub *Hub, c *Client, data json.RawMessage) {
	var req struct {
		Name string `json:"name"`
	}

	json.Unmarshal(data, &req)

	code := generateID()

	room := &game.Room{
		Code:   code,
		HostID: c.id,
		State:  game.StateLobby,
		Players: map[string]*game.Player{
			c.id: {
				ID:   c.id,
				Name: req.Name,
			},
		},
	}

	c.roomCode = room.Code

	hub.rooms.Create(room)

	hub.BroadcastLobbyState(room)
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}
