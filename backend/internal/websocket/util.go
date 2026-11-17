package websocket

import (
	crand "crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"unicode"
)

const idAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789"

// randomString draws from crypto/rand without modulo bias; sessionIds are the only auth credential.
func randomString(n int) string {
	const limit = 256 - (256 % len(idAlphabet)) // largest multiple of len <= 256
	out := make([]byte, 0, n)
	buf := make([]byte, n+n/4)
	for len(out) < n {
		crand.Read(buf)
		for _, b := range buf {
			if int(b) < limit && len(out) < n {
				out = append(out, idAlphabet[int(b)%len(idAlphabet)])
			}
		}
	}
	return string(out)
}

func generateID() string { return randomString(12) }

func generateSessionID() string { return randomString(25) }

func generateLobbyCode() string { return randomString(6) }

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

// hashSession fingerprints a sessionId for logs, which must never hold it in the clear.
func hashSession(id string) string {
	if id == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(id))
	return hex.EncodeToString(sum[:4]) // 8 hex chars, enough to correlate logs
}

// cleanName drops control, format (zero-width, bidi) and private-use runes and
// trims what is left.
func cleanName(s string) string {
	return strings.TrimSpace(strings.Map(func(r rune) rune {
		if unicode.In(r, unicode.Cc, unicode.Cf, unicode.Co) {
			return -1
		}
		return r
	}, s))
}
