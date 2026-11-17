package websocket

import (
	"encoding/json"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"

	"slf/internal/game"
	"slf/internal/stats"
)

func TestGameEndsCounted(t *testing.T) {
	path := filepath.Join(t.TempDir(), "events.jsonl")
	l, err := stats.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	hub := NewHub()
	hub.Stats = l
	lobby := func(code string, state game.GameState) *game.Lobby {
		lb := &game.Lobby{Code: code, State: state, Players: map[string]*game.Player{},
			Game: &game.Game{UsedLetters: []string{"A", "B"}}}
		hub.rooms.Create(lb)
		return lb
	}
	hub.closeLobby(lobby("aaaaaa", game.StatePlaying), "hostLeft")
	hub.closeLobby(lobby("bbbbbb", game.StateRoundResult), "abandoned")
	over := lobby("cccccc", game.StatePlaying)
	hub.endGame(over, "HostEnded")
	hub.closeLobby(over, "hostLeft")

	b, _ := os.ReadFile(path)
	var got []string
	for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
		var e stats.Event
		if json.Unmarshal([]byte(line), &e) != nil {
			continue
		}
		got = append(got, e.Ev+" "+e.Reason+" "+strconv.Itoa(e.Rounds))
	}
	want := []string{"end hostLeft 1", "end abandoned 2", "end HostEnded 1"}
	if !slices.Equal(got, want) {
		t.Fatalf("got %q, want %q", got, want)
	}
}
