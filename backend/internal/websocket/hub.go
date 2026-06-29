package websocket

type Hub struct {
	clients map[*Client]bool
	rooms   map[string]*Room

	register chan *Client
}

func NewHub() *Hub {
	return &Hub{
		clients:  make(map[*Client]bool),
		rooms:    make(map[string]*Room),
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
