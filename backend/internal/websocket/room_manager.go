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
