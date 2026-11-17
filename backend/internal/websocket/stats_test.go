package websocket

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

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
		hub.rooms[lb.Code] = lb
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

// A stats write that blocks on a full pipe must not hold hub.mu.
func TestStatsWriteOutsideLock(t *testing.T) {
	path := filepath.Join(t.TempDir(), "events.fifo")
	if err := syscall.Mkfifo(path, 0o600); err != nil {
		t.Skip(err)
	}
	r, err := os.OpenFile(path, os.O_RDONLY|syscall.O_NONBLOCK, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	fill, err := syscall.Open(path, syscall.O_WRONLY|syscall.O_NONBLOCK, 0)
	if err != nil {
		t.Fatal(err)
	}
	defer syscall.Close(fill)
	for {
		if _, err := syscall.Write(fill, make([]byte, 4096)); err != nil {
			break
		}
	}
	l, err := stats.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	hub := NewHub()
	hub.Stats = l
	lb := &game.Lobby{Code: "aaaaaa", State: game.StatePlaying, Players: map[string]*game.Player{},
		Game: &game.Game{UsedLetters: []string{"A"}}}
	hub.rooms[lb.Code] = lb
	done := make(chan struct{})
	go func() { hub.closeLobby(lb, "hostLeft"); close(done) }()

	deadline := time.Now().Add(2 * time.Second)
	for {
		if hub.mu.TryLock() {
			_, open := hub.rooms["aaaaaa"]
			hub.mu.Unlock()
			if !open {
				break
			}
		}
		if time.Now().After(deadline) {
			t.Fatal("hub.mu held while the stats write blocks")
		}
		time.Sleep(time.Millisecond)
	}
	go io.Copy(io.Discard, r)
	<-done
}
