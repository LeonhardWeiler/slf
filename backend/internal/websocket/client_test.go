package websocket

import (
	"net/http/httptest"
	"testing"
)

func TestOriginAllowed(t *testing.T) {
	cases := []struct {
		name   string
		reqURL string // sets the request Host
		origin string // Origin header ("" = none)
		want   bool
	}{
		{"no origin (native/test client)", "http://game.example.com/ws", "", true},
		{"same-origin localhost", "http://localhost:8080/ws", "http://localhost:8080", true},
		{"same-origin domain", "https://game.example.com/ws", "https://game.example.com", true},
		{"same-origin LAN ip", "http://192.168.1.5:8080/ws", "http://192.168.1.5:8080", true},
		{"dev: vite localhost cross-port", "http://localhost:8080/ws", "http://localhost:5173", true},
		{"dev: vite LAN ip cross-port", "http://192.168.1.5:8080/ws", "http://192.168.1.5:5173", true},
		{"loopback 127.0.0.1", "http://localhost:8080/ws", "http://127.0.0.1:5173", true},
		{"public attacker", "https://game.example.com/ws", "https://evil.com", false},
		{"look-alike private prefix", "https://game.example.com/ws", "http://192.168.evil.com", false},
		{"look-alike localhost subdomain", "https://game.example.com/ws", "http://localhost.evil.com", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", tc.reqURL, nil)
			if tc.origin != "" {
				r.Header.Set("Origin", tc.origin)
			}
			if got := originAllowed(r); got != tc.want {
				t.Errorf("originAllowed(host=%q, origin=%q) = %v, want %v",
					r.Host, tc.origin, got, tc.want)
			}
		})
	}
}
