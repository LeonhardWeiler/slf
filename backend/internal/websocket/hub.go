package websocket

type Hub struct {
    clients map[*Client]bool
    rooms *RoomManager
    register chan *Client
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[*Client]bool),
		rooms: NewRoomManager(),
		register: make(chan *Client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			println("Client connected")
		}
	}
}

func (h *Hub) BroadcastLobbyState(room *game.Room) {
	players := make([]*game.Player, 0, len(room.Players))

	for _, p := range room.Players {
		players = append(players, p)
	}

	state := map[string]any{
		"code":    room.Code,
		"hostId":  room.HostID,
		"players": players,
		"state":   room.State,
	}

	for client := range h.clients {
		if client.roomCode != room.Code {
			continue
		}

		client.Send("lobby_state", state)
	}
}
