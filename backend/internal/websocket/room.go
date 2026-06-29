package websocket

type Player struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Host bool   `json:"host"`
}

type Room struct {
	Code    string
	Players map[string]*Player
}
