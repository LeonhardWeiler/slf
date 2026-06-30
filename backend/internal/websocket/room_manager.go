package websocket

import "slf/internal/game"

type RoomManager struct {
	rooms map[string]*game.Room
}

func NewRoomManager() *RoomManager {
	return &RoomManager{
		rooms: make(map[string]*game.Room),
	}
}

func (rm *RoomManager) Create(room *game.Room) {
	rm.rooms[room.Code] = room
}

func (rm *RoomManager) Get(code string) (*game.Room, bool) {
	room, ok := rm.rooms[code]
	return room, ok
}

func (rm *RoomManager) Delete(code string) {
	delete(rm.rooms, code)
}
