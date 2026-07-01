package websocket

import (
	crand "crypto/rand"
	"fmt"
	"math/rand"
)

// generateID returns a 12-char opaque id from a 36-char alphabet, drawn from
// crypto/rand. IDs double as the sessionId — the only auth credential — so they
// must be unpredictable (not math/rand). Rejection sampling keeps the mapping
// unbiased.
func generateID() string {
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	const n = len(chars)
	const limit = 256 - (256 % n) // largest multiple of n <= 256

	out := make([]byte, 12)
	buf := make([]byte, 1)
	for i := 0; i < len(out); {
		if _, err := crand.Read(buf); err != nil {
			panic(err) // crypto/rand should never fail
		}
		if int(buf[0]) >= limit {
			continue // reject to avoid modulo bias
		}
		out[i] = chars[int(buf[0])%n]
		i++
	}
	return string(out)
}

// generateLobbyCode returns a 6-digit code. It stays on math/rand: the code is a
// public join token (no secrecy needed) and collisions are handled by
// hub.uniqueLobbyCode.
func generateLobbyCode() string {
	return fmt.Sprintf("%06d", rand.Intn(1000000))
}
