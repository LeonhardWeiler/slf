package websocket

import (
	"os"
	"path/filepath"
	"slices"
	"strings"
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

func TestBeginCountdownRechecksState(t *testing.T) {
	h := NewHub()
	lobby := &game.Lobby{
		Code:     "123456",
		State:    game.StateLobby,
		Settings: game.Settings{HostPlays: true},
		Players:  map[string]*game.Player{"p": {ID: "p", Connected: true}},
		Game:     &game.Game{RemainingLetters: []string{"A", "B"}},
	}
	h.rooms.Create(lobby)

	h.beginCountdown(lobby, game.StateLobby)
	first := lobby.Game.Round
	h.beginCountdown(lobby, game.StateLobby)
	if lobby.Game.Round != first {
		t.Fatal("a second start from a stale state began another round")
	}
}

func TestGameStateSendsAbsoluteDeadline(t *testing.T) {
	limit := 60
	endsAt := time.Now().Add(time.Minute)
	lobby := &game.Lobby{
		State:    game.StatePlaying,
		Settings: game.Settings{TimeLimit: &limit},
		Game:     &game.Game{Round: &game.Round{StartedAt: time.Now(), EndsAt: endsAt}},
	}
	p := buildGameState(lobby)
	if p.EndsAt == nil || *p.EndsAt != endsAt.UnixMilli() {
		t.Fatalf("endsAt = %v, want %d", p.EndsAt, endsAt.UnixMilli())
	}
	if d := time.Now().UnixMilli() - p.ServerNow; d < 0 || d > 1000 {
		t.Fatalf("serverNow off by %d ms", d)
	}
}

func TestLobbyPatchKeepsOnlyChangedPlayers(t *testing.T) {
	prev := []game.LobbyPlayer{{ID: "a", Name: "A"}, {ID: "b", Name: "B"}, {ID: "c", Name: "C"}}
	next := game.LobbyStatePayload{Players: []game.LobbyPlayer{
		{ID: "a", Name: "A"}, {ID: "b", Name: "B", Score: 5}, {ID: "d", Name: "D"},
	}}
	p := lobbyPatch(prev, next)
	var ids []string
	for _, pl := range p.Players {
		ids = append(ids, pl.ID)
	}
	if !slices.Equal(ids, []string{"b", "d"}) || !slices.Equal(p.Removed, []string{"c"}) {
		t.Fatalf("players %v removed %v, want [b d] [c]", ids, p.Removed)
	}
}

func TestStoreAnswerKeepsOnlyTrimmedValue(t *testing.T) {
	round := &game.Round{Answers: map[string]map[string]*game.Answer{}}
	storeAnswer(round, "p", "c", strings.Repeat(" ", 60000)+"Äpfel ")
	if got := answerFor(round, "p", "c").Value; got != "Äpfel" {
		t.Fatalf("stored %d bytes, want trimmed value", len(got))
	}
	storeAnswer(round, "p", "c", strings.Repeat("ß", 31))
	if answerFor(round, "p", "c") != nil {
		t.Fatal("a 31-rune answer must be dropped")
	}
	storeAnswer(round, "p", "c", strings.Repeat("ß", 30))
	if answerFor(round, "p", "c") == nil {
		t.Fatal("a 30-rune answer must be kept")
	}
}

func TestHiddenCountdownKeepsLetterOutOfLists(t *testing.T) {
	h := NewHub()
	lobby := &game.Lobby{
		Code:     "123456",
		State:    game.StateLobby,
		Settings: game.Settings{HostPlays: true},
		Players:  map[string]*game.Player{"p": {ID: "p", Connected: true}},
		Game:     &game.Game{RemainingLetters: []string{"A", "B"}},
	}
	h.rooms.Create(lobby)

	h.beginCountdown(lobby, game.StateLobby)
	p := buildGameState(lobby)
	if p.Letter != "" || len(p.UsedLetters) != 0 || len(p.RemainingLetters) != 2 {
		t.Fatalf("countdown leaks the letter: %+v", p)
	}
	h.beginPlaying(lobby, lobby.Game.Round.ID)
	p = buildGameState(lobby)
	if !slices.Equal(p.UsedLetters, []string{p.Letter}) || len(p.RemainingLetters) != 1 || p.RemainingLetters[0] == p.Letter {
		t.Fatalf("playing lists wrong: %+v", p)
	}
}

func TestLobbyFullIgnoresLeftPlayersUpToHistoryCap(t *testing.T) {
	lobby := &game.Lobby{Players: map[string]*game.Player{}}
	add := func(n int, left bool) {
		for range n {
			id := generateID()
			lobby.Players[id] = &game.Player{ID: id, Left: left}
		}
	}
	add(maxPlayersPerLobby-1, false)
	add(maxPlayersPerLobby, true)
	if lobbyFull(lobby) {
		t.Fatal("left players must not take active seats")
	}
	add(1, true)
	if !lobbyFull(lobby) {
		t.Fatal("the history cap must bound the lobby")
	}
}

func TestLoadKeepsBrokenSnapshot(t *testing.T) {
	path := filepath.Join(t.TempDir(), "lobbies.json")
	os.WriteFile(path, []byte(`[{"code":"123456","players":{"p":null}},{"code":`), 0o600)
	if err := NewHub().Load(path); err == nil {
		t.Fatal("a truncated snapshot must fail to load")
	}
	if _, err := os.Stat(path + ".broken"); err != nil {
		t.Fatal("the broken snapshot must be kept")
	}

	os.WriteFile(path, []byte(`[null,{"code":""},{"code":"123456","players":{"p":null}}]`), 0o600)
	h := NewHub()
	if err := h.Load(path); err != nil || len(h.rooms.All()) != 0 {
		t.Fatalf("invalid entries must be skipped: err=%v", err)
	}
}

func TestHealthDetectsStuckHub(t *testing.T) {
	h := NewHub()
	if live, draining := h.Health(time.Second); !live || draining {
		t.Fatal("idle hub must be live")
	}
	h.mu.Lock()
	live, _ := h.Health(50 * time.Millisecond)
	h.mu.Unlock()
	if live {
		t.Fatal("a held hub lock must report not live")
	}
}
