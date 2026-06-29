package websocket

import (
	"context"
	"encoding/json"

	"github.com/coder/websocket"
)

func handleCreateLobby(hub *Hub, c *Client, data json.RawMessage) {
	var req struct {
		Name string `json:"name"`
	}

	json.Unmarshal(data, &req)

	code := generateID()

	room := &Room{
		Code: code,
		Players: map[string]*Player{
			c.id: {
				ID:   c.id,
				Name: req.Name,
				Host: true,
			},
		},
	}

	hub.rooms[code] = room

	sendLobbyState(c, room)
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

func sendLobbyState(c *Client, room *Room) {
	type Response struct {
		Event string `json:"event"`
		Data  any    `json:"data"`
	}

	players := []*Player{}
	for _, p := range room.Players {
		players = append(players, p)
	}

	resp := Response{
		Event: "lobby_state",
		Data: map[string]any{
			"code":    room.Code,
			"players": players,
		},
	}

	c.conn.Write(
		context.Background(),
		websocket.MessageText,
		mustJSON(resp),
	)
}
