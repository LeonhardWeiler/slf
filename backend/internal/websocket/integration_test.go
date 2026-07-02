package websocket

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

// End-to-end tests that drive the real WebSocket protocol against an
// httptest server wired to ServeWS — the same entry point cmd/server uses.
// These guard the message contract and the core game flow against regressions.

// --- test harness ---

type testConn struct {
	t         *testing.T
	conn      *websocket.Conn
	sessionID string
	lastLobby lobbyStateDTO
}

func newServer(t *testing.T) *httptest.Server {
	t.Helper()
	srv, _ := newServerHub(t)
	return srv
}

// newServerHub is like newServer but also returns the hub so a test can tweak
// it (e.g. shorten the host-grace window).
func newServerHub(t *testing.T) (*httptest.Server, *Hub) {
	t.Helper()
	hub := NewHub()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, w, r)
	}))
	t.Cleanup(srv.Close)
	return srv, hub
}

func dial(t *testing.T, srv *httptest.Server) *testConn {
	t.Helper()
	url := "ws" + strings.TrimPrefix(srv.URL, "http")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	conn, _, err := websocket.Dial(ctx, url, nil)
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	tc := &testConn{t: t, conn: conn}
	t.Cleanup(func() { conn.Close(websocket.StatusNormalClosure, "") })
	return tc
}

func (c *testConn) send(msgType string, payload map[string]any) {
	c.t.Helper()
	raw, _ := json.Marshal(payload)
	msg, _ := json.Marshal(InboundMessage{Type: msgType, Payload: raw, SessionID: c.sessionID})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := c.conn.Write(ctx, websocket.MessageText, msg); err != nil {
		c.t.Fatalf("write %s: %v", msgType, err)
	}
}

// waitFor reads messages until one of the given type arrives (or times out) and
// returns its raw payload. Messages of other types are skipped.
func (c *testConn) waitFor(msgType string) json.RawMessage {
	c.t.Helper()
	deadline := time.Now().Add(6 * time.Second)
	for {
		ctx, cancel := context.WithDeadline(context.Background(), deadline)
		_, raw, err := c.conn.Read(ctx)
		cancel()
		if err != nil {
			c.t.Fatalf("waiting for %q: %v", msgType, err)
		}
		var m struct {
			Type    string          `json:"type"`
			Payload json.RawMessage `json:"payload"`
		}
		if err := json.Unmarshal(raw, &m); err != nil {
			continue
		}
		if m.Type == msgType {
			return m.Payload
		}
	}
}

// createLobby dials, creates a lobby and returns the connection, the lobby code
// and the (now populated) session id.
func (c *testConn) createLobby(name string) string {
	c.t.Helper()
	c.send("createLobby", map[string]any{"playerName": name})
	var sc struct {
		SessionID string `json:"sessionId"`
	}
	json.Unmarshal(c.waitFor("sessionCreated"), &sc)
	c.sessionID = sc.SessionID
	var ls lobbyStateDTO
	json.Unmarshal(c.waitFor("lobbyState"), &ls)
	c.lastLobby = ls
	return ls.LobbyCode
}

type lobbyStateDTO struct {
	LobbyCode string `json:"lobbyCode"`
	State     string `json:"state"`
	Players   []struct {
		ID     string `json:"id"`
		Name   string `json:"name"`
		IsHost bool   `json:"isHost"`
	} `json:"players"`
	Categories []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"categories"`
	Settings struct {
		TimeLimit       *int     `json:"timeLimit"`
		ExcludedLetters []string `json:"excludedLetters"`
		FlamesEnabled   bool     `json:"flamesEnabled"`
		HostPlays       bool     `json:"hostPlays"`
		LastLetterMode  bool     `json:"lastLetterMode"`
	} `json:"settings"`
}

// --- tests ---

func TestCreateAndJoinLobby(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	code := host.createLobby("Alice")
	if len(code) == 0 {
		t.Fatal("expected a lobby code")
	}

	// A second player joins; both sides should see two players.
	guest := dial(t, srv)
	guest.send("joinLobby", map[string]any{"playerName": "Bob", "lobbyCode": code})
	var sc struct {
		SessionID string `json:"sessionId"`
	}
	json.Unmarshal(guest.waitFor("sessionCreated"), &sc)
	guest.sessionID = sc.SessionID

	var ls lobbyStateDTO
	json.Unmarshal(guest.waitFor("lobbyState"), &ls)
	if len(ls.Players) != 2 {
		t.Fatalf("expected 2 players, got %d", len(ls.Players))
	}
}

func TestJoinUnknownLobbyErrors(t *testing.T) {
	srv := newServer(t)
	c := dial(t, srv)
	c.send("joinLobby", map[string]any{"playerName": "Bob", "lobbyCode": "ZZZZZZ"})
	var e struct {
		Code string `json:"code"`
	}
	json.Unmarshal(c.waitFor("error"), &e)
	if e.Code != string(CodeLobbyNotFound) {
		t.Fatalf("expected %s, got %q", CodeLobbyNotFound, e.Code)
	}
}

// todo: checkLobby lets the join UI show "mid-game / full / unknown" already at
// the code step, before a name is asked.
func TestCheckLobbyReportsAvailability(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	code := host.createLobby("Alice")

	guest := dial(t, srv)
	var chk struct {
		Available bool   `json:"available"`
		Reason    string `json:"reason"`
	}

	// A fresh lobby is joinable.
	guest.send("checkLobby", map[string]any{"lobbyCode": code})
	json.Unmarshal(guest.waitFor("lobbyCheck"), &chk)
	if !chk.Available {
		t.Fatalf("expected fresh lobby available, got reason %q", chk.Reason)
	}

	// An unknown code reports notFound.
	guest.send("checkLobby", map[string]any{"lobbyCode": "ZZZZZZ"})
	json.Unmarshal(guest.waitFor("lobbyCheck"), &chk)
	if chk.Available || chk.Reason != "notFound" {
		t.Fatalf("expected notFound, got available=%v reason=%q", chk.Available, chk.Reason)
	}

	// A running game is still joinable (the joiner waits as a spectator and plays
	// from the next round), so checkLobby keeps reporting available. Wait for the
	// host's gameState so the state transition has definitely happened first.
	host.send("startGame", map[string]any{})
	host.waitFor("gameState")
	guest.send("checkLobby", map[string]any{"lobbyCode": code})
	json.Unmarshal(guest.waitFor("lobbyCheck"), &chk)
	if !chk.Available {
		t.Fatalf("expected a running lobby to still be joinable, got reason %q", chk.Reason)
	}
}

// ux-leave: joining a running game is allowed; the joiner is pending (a spectator
// who does not appear in the standings) until the next round begins.
func TestJoinMidGameIsPending(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	code := host.createLobby("Alice")

	host.send("startGame", map[string]any{})
	host.waitFor("gameState")

	// Bob joins mid-game → accepted, and the lobbyState marks him pending.
	guest := dial(t, srv)
	guest.send("joinLobby", map[string]any{"playerName": "Bob", "lobbyCode": code})
	var sc struct {
		SessionID string `json:"sessionId"`
		PlayerID  string `json:"playerId"`
	}
	json.Unmarshal(guest.waitFor("sessionCreated"), &sc)
	guest.sessionID = sc.SessionID

	var ls struct {
		Players []struct {
			ID      string `json:"id"`
			Name    string `json:"name"`
			Pending bool   `json:"pending"`
		} `json:"players"`
	}
	json.Unmarshal(guest.waitFor("lobbyState"), &ls)
	var bob *struct {
		ID      string `json:"id"`
		Name    string `json:"name"`
		Pending bool   `json:"pending"`
	}
	for i := range ls.Players {
		if ls.Players[i].Name == "Bob" {
			bob = &ls.Players[i]
		}
	}
	if bob == nil {
		t.Fatal("expected Bob in the lobby after a mid-game join")
	}
	if !bob.Pending {
		t.Fatal("expected a mid-game joiner to be pending")
	}

	// A mid-game joiner also gets the current phase replayed (gameState) so their
	// screen isn't blank.
	guest.waitFor("gameState")
}

// ux-leave: a pending joiner is excluded from the standings during the round it
// joined, and becomes a full participant when the next round begins.
func TestPendingJoinerActivatesNextRound(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	code := host.createLobby("Alice")

	// Keep two letters (A, B) so a second round can start after the first.
	excluded := []string{}
	for r := 'C'; r <= 'Z'; r++ {
		excluded = append(excluded, string(r))
	}
	host.send("updateSettings", map[string]any{"timeLimit": nil, "excludedLetters": excluded})
	host.readLobby()

	host.send("startGame", map[string]any{})
	var gs struct {
		State string `json:"state"`
	}
	for gs.State != "Playing" {
		json.Unmarshal(host.waitFor("gameState"), &gs)
	}

	// Bob joins mid-round → pending.
	guest := dial(t, srv)
	guest.send("joinLobby", map[string]any{"playerName": "Bob", "lobbyCode": code})
	var sc struct {
		SessionID string `json:"sessionId"`
		PlayerID  string `json:"playerId"`
	}
	json.Unmarshal(guest.waitFor("sessionCreated"), &sc)
	guest.sessionID = sc.SessionID
	bobID := sc.PlayerID

	// Host ends the round and finishes review → RoundResult. Bob must not appear
	// in the ranking while pending.
	host.send("endRound", map[string]any{})
	host.waitFor("reviewState")
	host.send("finishReview", map[string]any{})
	var rr struct {
		Ranking []struct {
			PlayerID string `json:"playerId"`
		} `json:"ranking"`
	}
	json.Unmarshal(host.waitFor("roundResult"), &rr)
	for _, r := range rr.Ranking {
		if r.PlayerID == bobID {
			t.Fatal("a pending joiner must not be in the ranking yet")
		}
	}

	// Next round begins → Bob is activated (pending cleared).
	host.send("startNextRound", map[string]any{})
	deadline := time.Now().Add(3 * time.Second)
	activated := false
	for time.Now().Before(deadline) && !activated {
		var ls struct {
			Players []struct {
				ID      string `json:"id"`
				Pending bool   `json:"pending"`
			} `json:"players"`
		}
		json.Unmarshal(guest.waitFor("lobbyState"), &ls)
		for _, p := range ls.Players {
			if p.ID == bobID && !p.Pending {
				activated = true
			}
		}
	}
	if !activated {
		t.Fatal("expected the pending joiner to be activated on the next round")
	}
}

// bug-3: all categories may be deleted; a round just needs >=1 to start.
func TestDeleteAllCategoriesThenStartFails(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	host.createLobby("Alice")

	// A fresh lobby seeds a few default categories. Deleting every one of them
	// must be allowed (previously the last category could not be removed).
	initial := host.lastLobby.Categories
	if len(initial) == 0 {
		t.Fatal("expected default categories on a fresh lobby")
	}
	for _, cat := range initial {
		host.send("deleteCategory", map[string]any{"categoryId": cat.ID})
		host.readLobby()
	}
	if len(host.lastLobby.Categories) != 0 {
		t.Fatalf("expected 0 categories after deleting all, got %d", len(host.lastLobby.Categories))
	}

	// Starting with no categories is rejected.
	host.send("startGame", map[string]any{})
	var e struct {
		Code string `json:"code"`
	}
	json.Unmarshal(host.waitFor("error"), &e)
	if e.Code == "" {
		t.Fatal("expected an error starting with no categories")
	}
}

// bug-1: omitting a bool option in updateSettings preserves the current value.
func TestUpdateSettingsPreservesOmittedBools(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	host.createLobby("Alice")

	// Turn flames on with a full-ish payload.
	host.send("updateSettings", map[string]any{
		"timeLimit":      nil,
		"flamesEnabled":  true,
		"hostPlays":      true,
		"lastLetterMode": false,
	})
	ls := host.readLobby()
	if !ls.Settings.FlamesEnabled {
		t.Fatal("flamesEnabled should be true after enabling it")
	}

	// A partial payload that omits flamesEnabled must not reset it to false.
	host.send("updateSettings", map[string]any{
		"timeLimit":      nil,
		"lastLetterMode": true,
	})
	ls = host.readLobby()
	if !ls.Settings.FlamesEnabled {
		t.Fatal("flamesEnabled must be preserved when omitted (bug-1)")
	}
	if !ls.Settings.LastLetterMode {
		t.Fatal("lastLetterMode should now be true")
	}
}

// bug-1 (extended): timeLimit and excludedLetters are also preserve-on-absent;
// timeLimit=null (unlimited) stays distinguishable from an omitted timeLimit.
func TestUpdateSettingsPreservesTimeLimitAndLetters(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	host.createLobby("Alice")

	// Set a concrete time limit and exclude a letter.
	host.send("updateSettings", map[string]any{
		"timeLimit":       60,
		"excludedLetters": []string{"Q"},
	})
	ls := host.readLobby()
	if ls.Settings.TimeLimit == nil || *ls.Settings.TimeLimit != 60 {
		t.Fatalf("expected timeLimit 60, got %v", ls.Settings.TimeLimit)
	}
	if len(ls.Settings.ExcludedLetters) != 1 || ls.Settings.ExcludedLetters[0] != "Q" {
		t.Fatalf("expected excluded [Q], got %v", ls.Settings.ExcludedLetters)
	}

	// A payload that omits both must leave them untouched (only toggles a bool).
	host.send("updateSettings", map[string]any{"flamesEnabled": true})
	ls = host.readLobby()
	if ls.Settings.TimeLimit == nil || *ls.Settings.TimeLimit != 60 {
		t.Fatalf("timeLimit must be preserved when omitted, got %v", ls.Settings.TimeLimit)
	}
	if len(ls.Settings.ExcludedLetters) != 1 || ls.Settings.ExcludedLetters[0] != "Q" {
		t.Fatalf("excludedLetters must be preserved when omitted, got %v", ls.Settings.ExcludedLetters)
	}

	// Explicit null clears the limit (unlimited) — must be honoured, not ignored.
	host.send("updateSettings", map[string]any{"timeLimit": nil})
	ls = host.readLobby()
	if ls.Settings.TimeLimit != nil {
		t.Fatalf("explicit null timeLimit should clear it, got %v", *ls.Settings.TimeLimit)
	}
}

func TestReconnectRestoresLobby(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	code := host.createLobby("Alice")

	// A fresh connection using the same session id gets the lobby back.
	again := dial(t, srv)
	again.sessionID = host.sessionID
	again.send("reconnect", map[string]any{})
	var ls lobbyStateDTO
	json.Unmarshal(again.waitFor("lobbyState"), &ls)
	if ls.LobbyCode != code {
		t.Fatalf("reconnect returned lobby %q, want %q", ls.LobbyCode, code)
	}
}

// sr-1: when the host drops, everyone is told (hostDisconnected); a host
// reconnect within the grace window cancels it (hostReconnected).
func TestHostGraceOnDisconnectAndReconnect(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	code := host.createLobby("Alice")

	guest := dial(t, srv)
	guest.send("joinLobby", map[string]any{"playerName": "Bob", "lobbyCode": code})
	guest.waitFor("lobbyState")

	// Host connection drops.
	host.conn.Close(websocket.StatusNormalClosure, "simulated drop")

	var hd struct {
		GraceSeconds int `json:"graceSeconds"`
	}
	json.Unmarshal(guest.waitFor("hostDisconnected"), &hd)
	if hd.GraceSeconds <= 0 {
		t.Fatalf("expected a positive grace window, got %d", hd.GraceSeconds)
	}

	// Host reconnects in time on a new socket → grace cancelled for everyone.
	back := dial(t, srv)
	back.sessionID = host.sessionID
	back.send("reconnect", map[string]any{})
	guest.waitFor("hostReconnected")
}

// sr-1 / test-1: if the host never returns, the grace timer fires and the lobby
// is closed with reason=hostDisconnected. Uses a shortened grace window.
func TestHostGraceExpiryClosesLobby(t *testing.T) {
	srv, hub := newServerHub(t)
	hub.setHostGraceDuration(300 * time.Millisecond)

	host := dial(t, srv)
	code := host.createLobby("Alice")
	guest := dial(t, srv)
	guest.send("joinLobby", map[string]any{"playerName": "Bob", "lobbyCode": code})
	guest.waitFor("lobbyState")

	// Host drops and does not come back.
	host.conn.Close(websocket.StatusNormalClosure, "simulated drop")
	guest.waitFor("hostDisconnected")

	var lc struct {
		Reason string `json:"reason"`
	}
	json.Unmarshal(guest.waitFor("lobbyClosed"), &lc)
	if lc.Reason != "hostDisconnected" {
		t.Fatalf("expected lobbyClosed reason hostDisconnected, got %q", lc.Reason)
	}
}

// Full round over the wire: start -> Countdown -> Playing -> answer -> buzz -> review.
func TestFullRoundCycle(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	host.createLobby("Alice")
	cats := host.lastLobby.Categories // the default categories

	// Force the drawn letter to be "A" by excluding every other letter, so the
	// answers we submit are deterministically rule-valid.
	excluded := []string{}
	for r := 'B'; r <= 'Z'; r++ {
		excluded = append(excluded, string(r))
	}
	host.send("updateSettings", map[string]any{"timeLimit": nil, "excludedLetters": excluded})
	host.readLobby()

	host.send("startGame", map[string]any{})

	// Countdown first, then Playing once the timer fires.
	var gs struct {
		State  string `json:"state"`
		Letter string `json:"letter"`
	}
	json.Unmarshal(host.waitFor("gameState"), &gs)
	if gs.State != "Countdown" {
		t.Fatalf("expected Countdown first, got %q", gs.State)
	}
	// Read further gameState messages until Playing.
	for gs.State != "Playing" {
		json.Unmarshal(host.waitFor("gameState"), &gs)
	}
	if gs.Letter != "A" {
		t.Fatalf("expected forced letter A, got %q", gs.Letter)
	}

	// Every category must be filled with a rule-valid answer to be able to buzz.
	for _, cat := range cats {
		host.send("answerUpdate", map[string]any{"categoryId": cat.ID, "value": "Aachen"})
	}
	host.send("buzz", map[string]any{})

	var rs struct {
		CategoryCount int `json:"categoryCount"`
	}
	json.Unmarshal(host.waitFor("reviewState"), &rs)
	if rs.CategoryCount != len(cats) {
		t.Fatalf("expected %d categories in review, got %d", len(cats), rs.CategoryCount)
	}
}

// readLobby waits for the next lobbyState and caches it.
func (c *testConn) readLobby() lobbyStateDTO {
	c.t.Helper()
	var ls lobbyStateDTO
	json.Unmarshal(c.waitFor("lobbyState"), &ls)
	c.lastLobby = ls
	return ls
}
