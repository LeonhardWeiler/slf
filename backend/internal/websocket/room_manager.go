package websocket

import "slf/internal/game"

type RoomManager struct {
	rooms map[string]*game.Lobby
}

func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms: make(map[string]*game.Lobby),
	}
}

func (rm *RoomManager) Create(room *game.Lobby) {
	rm.rooms[room.Code] = room
}

func (rm *RoomManager) Get(code string) (*game.Lobby, bool) {
	room, ok := rm.rooms[code]
	return room, ok
}

func (rm *RoomManager) Delete(code string) {
	delete(rm.rooms, code)
}

func (rm *RoomManager) Count() int {
	return len(rm.rooms)
}

// All returns a snapshot slice of the current lobbies. Caller must hold the hub
// mutex (the RoomManager itself is not independently synchronised).
func (rm *RoomManager) All() []*game.Lobby {
	out := make([]*game.Lobby, 0, len(rm.rooms))
	for _, r := range rm.rooms {
		out = append(out, r)
	}
	return out
}
