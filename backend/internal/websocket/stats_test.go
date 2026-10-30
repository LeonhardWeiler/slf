package websocket

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"slf/internal/game"
	"slf/internal/stats"
)

func TestHandleTrack(t *testing.T) {
	path := filepath.Join(t.TempDir(), "events.jsonl")
	l, err := stats.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	hub := NewHub()
	hub.Stats = l
	lobby := &game.Lobby{Code: "ABCD", Players: map[string]*game.Player{"p": {ID: "p"}}}
	hub.rooms.Create(lobby)
	hub.sessions["s"] = &game.Session{ID: "s", PlayerID: "p", LobbyCode: "ABCD"}
	c := &Client{sessionID: "s"}
	handleTrack(hub, &Client{}, json.RawMessage(`{"ev":"world","value":"candy"}`))
	for _, p := range []string{
		`{"ev":"world","value":"candy"}`,
		`{"ev":"world","value":"rubber"}`,
		`{"ev":"musicOff","scene":"play"}`,
		`{"ev":"hack","value":"x"}`,
		`{"ev":"mute","value":"<script>"}`,
	} {
		handleTrack(hub, c, json.RawMessage(p))
	}
	lobby.Game = &game.Game{Round: &game.Round{ID: "r2"}}
	handleTrack(hub, c, json.RawMessage(`{"ev":"world","value":"rubber"}`))
	b, _ := os.ReadFile(path)
	if n := strings.Count(string(b), "\n"); n != 3 {
		t.Fatalf("%d events: %s", n, b)
	}
}
