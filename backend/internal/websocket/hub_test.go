package websocket

import (
	"testing"
	"time"

	"slf/internal/game"
)

func TestReapAbandoned(t *testing.T) {
	h := NewHub()

	// A lobby with no connected client.
	lobby := &game.Lobby{
		Code:    "123456",
		Players: map[string]*game.Player{"p1": {ID: "p1", SessionID: "s1"}},
	}
	h.rooms.Create(lobby)

	// First pass only marks EmptySince, does not reap.
	h.reapAbandoned()
	if _, ok := h.rooms.Get("123456"); !ok {
		t.Fatal("lobby reaped too early")
	}
	if lobby.EmptySince.IsZero() {
		t.Fatal("EmptySince should be set for an empty lobby")
	}

	// Backdate past the TTL -> reaped on the next pass.
	lobby.EmptySince = time.Now().Add(-lobbyTTL - time.Minute)
	h.reapAbandoned()
	if _, ok := h.rooms.Get("123456"); ok {
		t.Fatal("abandoned lobby should have been reaped")
	}

	// A lobby with a connected client is never reaped and EmptySince stays clear.
	lobby2 := &game.Lobby{
		Code:       "654321",
		Players:    map[string]*game.Player{"p2": {ID: "p2", SessionID: "s2"}},
		EmptySince: time.Now().Add(-lobbyTTL - time.Minute),
	}
	h.rooms.Create(lobby2)
	h.clients["s2"] = &Client{}
	h.reapAbandoned()
	if _, ok := h.rooms.Get("654321"); !ok {
		t.Fatal("a lobby with a connected client must not be reaped")
	}
	if !lobby2.EmptySince.IsZero() {
		t.Fatal("EmptySince should be cleared while a client is connected")
	}
}
