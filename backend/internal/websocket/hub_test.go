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

func TestHasRoundParticipant(t *testing.T) {
	// A connected, non-host player counts as a participant.
	playing := &game.Lobby{
		Settings: game.Settings{HostPlays: true},
		Players: map[string]*game.Player{
			"h": {ID: "h", IsHost: true, Connected: true},
			"p": {ID: "p", Connected: true},
		},
	}
	if !hasRoundParticipant(playing) {
		t.Error("a connected player should count as a participant")
	}

	// Everyone disconnected -> no participant (round must not start).
	gone := &game.Lobby{
		Settings: game.Settings{HostPlays: true},
		Players: map[string]*game.Player{
			"h": {ID: "h", IsHost: true, Connected: false},
			"p": {ID: "p", Connected: false},
		},
	}
	if hasRoundParticipant(gone) {
		t.Error("an all-disconnected lobby has no participant")
	}

	// A left player does not count even while still connected.
	left := &game.Lobby{
		Settings: game.Settings{HostPlays: true},
		Players: map[string]*game.Player{
			"p": {ID: "p", Connected: true, Left: true},
		},
	}
	if hasRoundParticipant(left) {
		t.Error("a player who left is not a participant")
	}

	// With a commentator host, the connected host alone is not a participant.
	commentatorOnly := &game.Lobby{
		Settings: game.Settings{HostPlays: false},
		Players: map[string]*game.Player{
			"h": {ID: "h", IsHost: true, Connected: true},
		},
	}
	if hasRoundParticipant(commentatorOnly) {
		t.Error("a commentator host alone should not count as a participant")
	}
}
