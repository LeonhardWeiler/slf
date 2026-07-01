package websocket

import (
	crand "crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"strings"
)

// idAlphabet is the 36-char set used for ids and lobby codes.
const idAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789"

// randomString returns an unbiased n-char string over idAlphabet, drawn from
// crypto/rand (rejection sampling avoids modulo bias). Used for both sessionIds
// (which must be unpredictable — they are the only auth credential) and lobby
// codes.
func randomString(n int) string {
	const limit = 256 - (256 % len(idAlphabet)) // largest multiple of len <= 256
	out := make([]byte, n)
	buf := make([]byte, 1)
	for i := 0; i < n; {
		if _, err := crand.Read(buf); err != nil {
			panic(err) // crypto/rand should never fail
		}
		if int(buf[0]) >= limit {
			continue // reject to avoid modulo bias
		}
		out[i] = idAlphabet[int(buf[0])%len(idAlphabet)]
		i++
	}
	return string(out)
}

func generateID() string { return randomString(12) }

// generateLobbyCode returns a 6-char [a-z0-9] join code (~2.2e9 combinations, far
// harder to enumerate than the old 6-digit space). Collisions are handled by
// hub.uniqueLobbyCode.
func generateLobbyCode() string { return randomString(6) }

// normalizeLobbyCode lower-cases and trims a client-supplied code and verifies it
// is exactly 6 chars of [a-z0-9]. Returns the normalized code and whether valid.
func normalizeLobbyCode(s string) (string, bool) {
	s = strings.ToLower(strings.TrimSpace(s))
	if len(s) != 6 {
		return "", false
	}
	for _, r := range s {
		if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')) {
			return "", false
		}
	}
	return s, true
}

// hashSession returns a short, non-reversible fingerprint of a sessionId for
// logging. The sessionId is the auth credential, so it must never be written to
// logs in the clear.
func hashSession(id string) string {
	if id == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(id))
	return hex.EncodeToString(sum[:4]) // 8 hex chars, enough to correlate logs
}
