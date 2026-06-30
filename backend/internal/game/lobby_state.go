package game

type LobbyState struct {
	Code    string     `json:"code"`
	State   GameState  `json:"state"`
	HostID  string     `json:"hostId"`
	Players []*Player  `json:"players"`
}
