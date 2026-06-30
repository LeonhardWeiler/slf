package game

type Room struct {
	Code string
	HostID string
	State GameState
	Players map[string]*Player
}
