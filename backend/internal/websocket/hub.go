package websocket

type Hub struct {
	clients map[*Client]bool
	register chan *Client
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[*Client]bool),
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
