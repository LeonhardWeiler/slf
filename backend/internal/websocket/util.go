package websocket

import (
	"fmt"
	"math/rand"
)

func generateID() string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 12)
	for i := range b {
		b[i] = chars[rand.Intn(len(chars))]
	}
	return string(b)
}

func generateLobbyCode() string {
	return fmt.Sprintf("%06d", rand.Intn(1000000))
}
