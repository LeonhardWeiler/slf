package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"

	"slf/internal/game"
)

// End-to-end tests that drive the real WebSocket protocol against an
// httptest server wired to ServeWS - the same entry point cmd/server uses.
// These guard the message contract and the core game flow against regressions.

// --- test harness ---

type testConn struct {
	t         *testing.T
	conn      *websocket.Conn
	sessionID string
	lastLobby lobbyStateDTO
	lobby     map[string]any // merged from lobbyState and lobbyPatch
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
	conn, res, err := websocket.Dial(ctx, url, &websocket.DialOptions{
		CompressionMode: websocket.CompressionNoContextTakeover,
	})
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	if ext := res.Header.Get("Sec-WebSocket-Extensions"); !strings.HasPrefix(ext, "permessage-deflate") {
		t.Fatalf("compression not negotiated: %q", ext)
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
		if m.Type == "lobbyState" || m.Type == "lobbyPatch" {
			m.Payload = c.mergeLobby(m.Type, m.Payload)
			m.Type = "lobbyState"
		}
		if m.Type == msgType {
			return m.Payload
		}
	}
}

// mergeLobby applies a lobbyState or lobbyPatch like the frontend does and
// returns the resulting full lobby state.
func (c *testConn) mergeLobby(typ string, raw json.RawMessage) json.RawMessage {
	var next map[string]any
	json.Unmarshal(raw, &next)
	if typ == "lobbyPatch" {
		byID := map[string]any{}
		var order []string
		add := func(ps any) {
			for _, p := range ps.([]any) {
				id := p.(map[string]any)["id"].(string)
				if _, ok := byID[id]; !ok {
					order = append(order, id)
				}
				byID[id] = p
			}
		}
		add(c.lobby["players"])
		add(next["players"])
		for _, id := range next["removed"].([]any) {
			delete(byID, id.(string))
		}
		players := []any{}
		for _, id := range order {
			if p, ok := byID[id]; ok {
				players = append(players, p)
			}
		}
		next["players"] = players
		delete(next, "removed")
	}
	c.lobby = next
	b, _ := json.Marshal(next)
	return b
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
	Solo      bool   `json:"solo"`
	Players   []struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		IsHost    bool   `json:"isHost"`
		Connected bool   `json:"connected"`
	} `json:"players"`
	Categories []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"categories"`
	Settings struct {
		TimeLimit       *int     `json:"timeLimit"`
		ExcludedLetters []string `json:"excludedLetters"`
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

func TestCreateLobbyBacksOff(t *testing.T) {
	srv := newServer(t)
	c := dial(t, srv)
	for range backoffFree {
		c.createLobby("Alice")
	}
	c.send("createLobby", map[string]any{"playerName": "Alice"})
	var e struct {
		Message string `json:"message"`
	}
	json.Unmarshal(c.waitFor("error"), &e)
	if !strings.Contains(e.Message, "Zu viele") {
		t.Fatalf("expected throttling, got %q", e.Message)
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

	// Bob joins mid-game -> accepted, and the lobbyState marks him pending.
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
	cats := host.lastLobby.Categories // the default categories
	carol := dial(t, srv)
	carol.send("joinLobby", map[string]any{"playerName": "Carol", "lobbyCode": code})
	carol.waitFor("sessionCreated")

	// Keep two letters (A, B) so a second round can start after the first.
	excluded := []string{}
	for r := 'C'; r <= 'Z'; r++ {
		excluded = append(excluded, string(r))
	}
	host.send("updateSettings", map[string]any{"timeLimit": nil, "excludedLetters": excluded})
	host.readLobby()

	host.send("startGame", map[string]any{})
	var gs struct {
		State   string `json:"state"`
		Letter  string `json:"letter"`
		RoundID string `json:"roundId"`
	}
	for gs.State != "Playing" {
		json.Unmarshal(host.waitFor("gameState"), &gs)
	}

	// Alice (the playing host) submits a valid answer so the round has something to
	// review - otherwise endRound would skip straight to the scoreboard.
	for _, cat := range cats {
		host.send("answerUpdate", map[string]any{"categoryId": cat.ID, "value": gs.Letter + "test", "roundId": gs.RoundID})
	}

	// Bob joins mid-round -> pending.
	guest := dial(t, srv)
	guest.send("joinLobby", map[string]any{"playerName": "Bob", "lobbyCode": code})
	var sc struct {
		SessionID string `json:"sessionId"`
		PlayerID  string `json:"playerId"`
	}
	json.Unmarshal(guest.waitFor("sessionCreated"), &sc)
	guest.sessionID = sc.SessionID
	bobID := sc.PlayerID

	// Host ends the round and finishes review -> RoundResult. Bob must not appear
	// in the ranking while pending.
	host.send("endRound", map[string]any{})
	if raw := host.waitFor("reviewState"); !strings.Contains(string(raw), `"endReason":"host"`) {
		t.Fatalf("expected endReason host, got %s", raw)
	}
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

	// Next round begins -> Bob is activated (pending cleared).
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

// point-5: when no active player submitted anything, ending the round skips the
// review screen and goes straight to the scoreboard (roundResult).
func TestEmptyRoundSkipsReview(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	code := host.createLobby("Alice")
	guest := dial(t, srv)
	guest.send("joinLobby", map[string]any{"playerName": "Bob", "lobbyCode": code})
	guest.waitFor("sessionCreated")

	// Force letter A so the round starts deterministically.
	excluded := []string{}
	for r := 'B'; r <= 'Z'; r++ {
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

	// No answers submitted -> ending the round jumps directly to the scoreboard.
	// waitFor("roundResult") only succeeds if review was skipped (the host never
	// sends finishReview here); a wrongly-entered review would time out instead.
	host.send("endRound", map[string]any{})
	var rr struct {
		IsGameOver bool `json:"isGameOver"`
		Empty      bool `json:"empty"`
	}
	json.Unmarshal(host.waitFor("roundResult"), &rr)
	if rr.IsGameOver {
		t.Fatal("an empty round should produce a normal RoundResult, not GameOver")
	}
	if !rr.Empty {
		t.Fatal("an empty round should be marked empty")
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

func TestCategoryLimit(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	host.createLobby("Alice")
	for i := len(host.lastLobby.Categories); i < maxCategoriesPerLobby; i++ {
		host.send("addCategory", map[string]any{"name": fmt.Sprintf("K%d", i)})
		host.readLobby()
	}
	host.send("addCategory", map[string]any{"name": "zu viel"})
	host.waitFor("error")
	if n := len(host.lastLobby.Categories); n != maxCategoriesPerLobby {
		t.Fatalf("got %d categories, want %d", n, maxCategoriesPerLobby)
	}
}

// bug-1: omitting a bool option in updateSettings preserves the current value.
func TestUpdateSettingsPreservesOmittedBools(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	host.createLobby("Alice")

	// Turn hostPlays off with a full-ish payload.
	host.send("updateSettings", map[string]any{
		"timeLimit":      nil,
		"hostPlays":      false,
		"lastLetterMode": false,
	})
	ls := host.readLobby()
	if ls.Settings.HostPlays {
		t.Fatal("hostPlays should be false after disabling it")
	}

	// A partial payload that omits hostPlays must not reset it to true.
	host.send("updateSettings", map[string]any{
		"timeLimit":      nil,
		"lastLetterMode": true,
	})
	ls = host.readLobby()
	if ls.Settings.HostPlays {
		t.Fatal("hostPlays must be preserved when omitted (bug-1)")
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
	host.send("updateSettings", map[string]any{"hostPlays": true})
	ls = host.readLobby()
	if ls.Settings.TimeLimit == nil || *ls.Settings.TimeLimit != 60 {
		t.Fatalf("timeLimit must be preserved when omitted, got %v", ls.Settings.TimeLimit)
	}
	if len(ls.Settings.ExcludedLetters) != 1 || ls.Settings.ExcludedLetters[0] != "Q" {
		t.Fatalf("excludedLetters must be preserved when omitted, got %v", ls.Settings.ExcludedLetters)
	}

	// Explicit null clears the limit (unlimited) - must be honoured, not ignored.
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

// A socket that stops answering pings (half-open) is closed and treated as a
// normal disconnect.
func TestUnansweredPingDisconnects(t *testing.T) {
	hub := NewHub()
	hub.pingInterval = 50 * time.Millisecond
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ServeWS(hub, w, r)
	}))
	t.Cleanup(srv.Close)
	host := dial(t, srv)
	code := host.createLobby("Alice")

	guest := dial(t, srv)
	guest.send("joinLobby", map[string]any{"playerName": "Bob", "lobbyCode": code})
	guest.waitFor("hostDisconnected")
}

func TestPingGetsPong(t *testing.T) {
	c := dial(t, newServer(t))
	c.send("ping", map[string]any{})
	c.waitFor("pong")
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

	// Host reconnects in time on a new socket -> grace cancelled for everyone.
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
	code := host.createLobby("Alice")
	cats := host.lastLobby.Categories // the default categories
	carol := dial(t, srv)
	carol.send("joinLobby", map[string]any{"playerName": "Carol", "lobbyCode": code})
	carol.waitFor("sessionCreated")

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
		State   string `json:"state"`
		Letter  string `json:"letter"`
		RoundID string `json:"roundId"`
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
		host.send("answerUpdate", map[string]any{"categoryId": cat.ID, "value": "Aachen", "roundId": gs.RoundID})
	}
	host.send("buzz", map[string]any{"roundId": gs.RoundID})

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

// todo-4: the host can kick a player during a running round. The kicked player
// is not removed but kept in the standings marked as "left", so they still show
// up as "(verlassen)".
func TestKickMidGameMarksPlayerLeft(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	code := host.createLobby("Alice")

	// Bob joins before the game starts -> full participant.
	guest := dial(t, srv)
	guest.send("joinLobby", map[string]any{"playerName": "Bob", "lobbyCode": code})
	var sc struct {
		SessionID string `json:"sessionId"`
		PlayerID  string `json:"playerId"`
	}
	json.Unmarshal(guest.waitFor("sessionCreated"), &sc)
	guest.sessionID = sc.SessionID
	bobID := sc.PlayerID
	guest.waitFor("lobbyState")

	host.send("startGame", map[string]any{})
	host.waitFor("gameState")

	// Host kicks Bob mid-game.
	host.send("kickPlayer", map[string]any{"playerId": bobID})

	// Bob is told he was kicked.
	var pk struct {
		PlayerID string `json:"playerId"`
	}
	json.Unmarshal(guest.waitFor("playerKicked"), &pk)
	if pk.PlayerID != bobID {
		t.Fatalf("expected playerKicked for %q, got %q", bobID, pk.PlayerID)
	}

	// The host's lobbyState keeps Bob around, now flagged left (-> "(verlassen)").
	deadline := time.Now().Add(3 * time.Second)
	for {
		if time.Now().After(deadline) {
			t.Fatal("expected kicked player to remain marked as left")
		}
		var ls struct {
			Players []struct {
				ID   string `json:"id"`
				Left bool   `json:"left"`
			} `json:"players"`
		}
		json.Unmarshal(host.waitFor("lobbyState"), &ls)
		for _, p := range ls.Players {
			if p.ID == bobID && p.Left {
				return
			}
		}
	}
}

// game-1: leaving mid-game is a final exit. The session must be invalidated so
// a client that kept the id cannot reconnect as a departed player - and the
// departed player's answers must never reach scoring, because review filters
// them out and the host could otherwise not see what changed the result.
func TestRejoinWithOwnNameAfterLeaving(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	code := host.createLobby("Alice")
	guest := dial(t, srv)
	guest.send("joinLobby", map[string]any{"playerName": "Bob", "lobbyCode": code})
	guest.waitFor("lobbyState")
	host.send("startGame", map[string]any{})
	host.waitFor("gameState")

	guest.send("leaveLobby", map[string]any{})
	host.readLobby()

	back := dial(t, srv)
	back.send("joinLobby", map[string]any{"playerName": "bob", "lobbyCode": code})
	back.waitFor("sessionCreated")
}

func TestLeaveMidGameInvalidatesSessionAndScoring(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	code := host.createLobby("Alice")
	cats := host.lastLobby.Categories

	// Force the drawn letter to "A" so the submitted answers are rule-valid.
	excluded := []string{}
	for r := 'B'; r <= 'Z'; r++ {
		excluded = append(excluded, string(r))
	}
	host.send("updateSettings", map[string]any{"timeLimit": nil, "excludedLetters": excluded})
	host.readLobby()

	guest := dial(t, srv)
	guest.send("joinLobby", map[string]any{"playerName": "Bob", "lobbyCode": code})
	var sc struct {
		SessionID string `json:"sessionId"`
		PlayerID  string `json:"playerId"`
	}
	json.Unmarshal(guest.waitFor("sessionCreated"), &sc)
	guest.sessionID = sc.SessionID
	bobID := sc.PlayerID
	guest.waitFor("lobbyState")

	host.send("startGame", map[string]any{})
	var gs struct {
		State   string `json:"state"`
		RoundID string `json:"roundId"`
	}
	for gs.State != "Playing" {
		json.Unmarshal(host.waitFor("gameState"), &gs)
	}

	// Bob leaves mid-round.
	guest.send("leaveLobby", map[string]any{})
	host.readLobby()

	// A fresh socket replaying Bob's old sessionId must be rejected.
	back := dial(t, srv)
	back.sessionID = guest.sessionID
	back.send("reconnect", map[string]any{})
	var errPayload struct {
		Code string `json:"code"`
	}
	json.Unmarshal(back.waitFor("error"), &errPayload)
	if errPayload.Code != string(CodeSessionNotFound) {
		t.Fatalf("expected %s after a mid-game leave, got %q", CodeSessionNotFound, errPayload.Code)
	}

	// Even if answers had slipped in, they must not affect the result: Alice is
	// the only participant, so every category is hers alone -> 5x the word each.
	back.send("answerUpdate", map[string]any{"categoryId": cats[0].ID, "value": "Aachen", "roundId": gs.RoundID})
	for _, cat := range cats {
		host.send("answerUpdate", map[string]any{"categoryId": cat.ID, "value": "Aachen", "roundId": gs.RoundID})
	}
	host.send("buzz", map[string]any{"roundId": gs.RoundID})

	// Alice is now alone, so the round is scored without review; with letter A
	// used up the game ends and the final ranking carries the totals.
	var rr struct {
		Ranking []struct {
			PlayerID string `json:"playerId"`
			Score    int    `json:"score"`
		} `json:"ranking"`
	}
	json.Unmarshal(host.waitFor("roundResult"), &rr)
	want := 5*game.WordValue("Aachen")*len(cats) + buzzBonus
	for _, s := range rr.Ranking {
		if s.PlayerID == bobID && s.Score != 0 {
			t.Fatalf("departed player scored %d points, expected 0", s.Score)
		}
		if s.PlayerID != bobID && s.Score != want {
			t.Fatalf("host scored %d, expected %d (a departed answer must not demote a unique answer)",
				s.Score, want)
		}
	}
}

// ux-2: starting with a commentator host and no *connected* co-player used to
// pass the start check and then silently fall back to Lobby in beginCountdown -
// the host clicked and nothing happened. The host must get a real error now.
func TestStartWithoutConnectedParticipantErrors(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	code := host.createLobby("Alice")

	guest := dial(t, srv)
	guest.send("joinLobby", map[string]any{"playerName": "Bob", "lobbyCode": code})
	var sc struct {
		SessionID string `json:"sessionId"`
	}
	json.Unmarshal(guest.waitFor("sessionCreated"), &sc)
	guest.waitFor("lobbyState")

	// Commentator mode: the host does not play, so Bob is the only participant.
	host.send("updateSettings", map[string]any{"hostPlays": false})
	host.readLobby()

	// Bob drops his connection - he stays in the lobby but is not connected.
	guest.conn.Close(websocket.StatusNormalClosure, "bye")
	deadline := time.Now().Add(3 * time.Second)
	for {
		if time.Now().After(deadline) {
			t.Fatal("expected Bob to show as disconnected")
		}
		ls := host.readLobby()
		connected := false
		for _, p := range ls.Players {
			if p.Name == "Bob" && p.Connected {
				connected = true
			}
		}
		if !connected {
			break
		}
	}

	host.send("startGame", map[string]any{})
	var e struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	}
	json.Unmarshal(host.waitFor("error"), &e)
	if e.Code != string(CodeValidationError) {
		t.Fatalf("expected %s, got %q (%s)", CodeValidationError, e.Code, e.Message)
	}
}

func TestDrainThenRestoreKeepsLobby(t *testing.T) {
	srv, hub := newServerHub(t)
	host := dial(t, srv)
	code := host.createLobby("Alice")

	hub.Drain(context.Background())
	host.send("startGame", map[string]any{})
	host.waitFor("error")

	path := filepath.Join(t.TempDir(), "lobbies.json")
	if err := hub.Save(path); err != nil {
		t.Fatal(err)
	}
	srv2, hub2 := newServerHub(t)
	hub2.setHostGraceDuration(time.Millisecond)
	if err := hub2.Load(path); err != nil {
		t.Fatal(err)
	}
	time.Sleep(50 * time.Millisecond)
	back := dial(t, srv2)
	back.sessionID = host.sessionID
	back.send("reconnect", map[string]any{})
	if ls := back.readLobby(); ls.LobbyCode != code {
		t.Fatalf("expected lobby %s after restore, got %q", code, ls.LobbyCode)
	}
}

// A lobby between rounds does not hold up a deploy and comes back as it was.
func TestDrainSavesRoundResult(t *testing.T) {
	srv, hub := newServerHub(t)
	host := dial(t, srv)
	code := host.createLobby("Alice")
	guest := dial(t, srv)
	guest.send("joinLobby", map[string]any{"playerName": "Bob", "lobbyCode": code})
	guest.waitFor("sessionCreated")
	host.send("startGame", map[string]any{})
	var gs struct {
		State string `json:"state"`
	}
	for gs.State != "Playing" {
		json.Unmarshal(host.waitFor("gameState"), &gs)
	}
	host.send("endRound", map[string]any{})
	host.waitFor("roundResult")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	hub.Drain(ctx)
	if ctx.Err() != nil {
		t.Fatal("drain waited for a lobby in RoundResult")
	}
	host.send("startNextRound", map[string]any{})
	host.waitFor("error")

	path := filepath.Join(t.TempDir(), "lobbies.json")
	if err := hub.Save(path); err != nil {
		t.Fatal(err)
	}
	srv2, hub2 := newServerHub(t)
	if err := hub2.Load(path); err != nil {
		t.Fatal(err)
	}
	back := dial(t, srv2)
	back.sessionID = host.sessionID
	back.send("reconnect", map[string]any{})
	back.waitFor("roundResult")
	back.send("startNextRound", map[string]any{})
	for gs.State != "Countdown" {
		json.Unmarshal(back.waitFor("gameState"), &gs)
	}
}

// The commentator board gets one row per change of a player's filled
// categories, not one message per keystroke.
func TestCommentatorGetsRowDeltas(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	code := host.createLobby("Alice")
	cat := host.lastLobby.Categories[0].ID
	excluded := []string{}
	for r := 'B'; r <= 'Z'; r++ {
		excluded = append(excluded, string(r))
	}
	host.send("updateSettings", map[string]any{"timeLimit": nil, "excludedLetters": excluded, "hostPlays": false})
	host.readLobby()
	guest := dial(t, srv)
	guest.send("joinLobby", map[string]any{"playerName": "Bob", "lobbyCode": code})
	var sc struct {
		SessionID string `json:"sessionId"`
	}
	json.Unmarshal(guest.waitFor("sessionCreated"), &sc)
	guest.sessionID = sc.SessionID

	host.send("startGame", map[string]any{})
	var cs struct {
		RoundID string `json:"roundId"`
	}
	json.Unmarshal(host.waitFor("commentatorState"), &cs)
	for _, v := range []string{"Aachen", "Aachener", ""} {
		guest.send("answerUpdate", map[string]any{"categoryId": cat, "value": v, "roundId": cs.RoundID})
	}
	var u struct {
		Player struct {
			FilledCategoryIDs []string `json:"filledCategoryIds"`
		} `json:"player"`
	}
	json.Unmarshal(host.waitFor("commentatorUpdate"), &u)
	if len(u.Player.FilledCategoryIDs) != 1 {
		t.Fatalf("first update: %v, want [%s]", u.Player.FilledCategoryIDs, cat)
	}
	json.Unmarshal(host.waitFor("commentatorUpdate"), &u)
	if len(u.Player.FilledCategoryIDs) != 0 {
		t.Fatalf("second update: %v, want []", u.Player.FilledCategoryIDs)
	}
}

func TestRebindingSocketFreesOldSeat(t *testing.T) {
	srv, hub := newServerHub(t)
	host := dial(t, srv)
	code := host.createLobby("Alice")
	guest := dial(t, srv)
	guest.send("joinLobby", map[string]any{"playerName": "Bob", "lobbyCode": code})
	guest.waitFor("lobbyState")

	if second := host.createLobby("Alice"); second == code || len(host.lastLobby.Players) != 1 {
		t.Fatalf("second lobby %s with %d players", second, len(host.lastLobby.Players))
	}
	guest.waitFor("hostDisconnected")

	hub.mu.Lock()
	defer hub.mu.Unlock()
	if len(hub.clients) != 2 {
		t.Fatalf("%d bound clients, want 2", len(hub.clients))
	}
	lobby, _ := hub.rooms.Get(code)
	for _, p := range lobby.Players {
		if p.IsHost && p.Connected {
			t.Fatal("old host seat still connected")
		}
	}
}

func TestReconnectClosesReplacedSocketWith4000(t *testing.T) {
	srv := newServer(t)
	first := dial(t, srv)
	first.createLobby("Alice")
	second := dial(t, srv)
	second.sessionID = first.sessionID
	second.send("reconnect", map[string]any{})
	second.waitFor("sessionCreated")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for {
		if _, _, err := first.conn.Read(ctx); err != nil {
			if code := websocket.CloseStatus(err); code != statusReplaced {
				t.Fatalf("close status %d, want %d", code, statusReplaced)
			}
			return
		}
	}
}

func TestShutdownRefusesNewSockets(t *testing.T) {
	srv, hub := newServerHub(t)
	host := dial(t, srv)
	host.createLobby("Alice")
	hub.Shutdown()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if _, _, err := host.conn.Read(ctx); websocket.CloseStatus(err) != websocket.StatusGoingAway {
		t.Fatalf("open socket: %v, want going away", err)
	}
	if _, _, err := dial(t, srv).conn.Read(ctx); websocket.CloseStatus(err) != websocket.StatusTryAgainLater {
		t.Fatalf("new socket: %v, want try again later", err)
	}
}

func TestShutdownClosesSocketsThatLeft(t *testing.T) {
	srv, hub := newServerHub(t)
	host := dial(t, srv)
	host.createLobby("Alice")
	host.send("leaveLobby", map[string]any{})
	host.waitFor("lobbyClosed")
	hub.Shutdown()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for {
		_, _, err := host.conn.Read(ctx)
		if err == nil {
			continue
		}
		if websocket.CloseStatus(err) != websocket.StatusGoingAway {
			t.Fatalf("socket after leave: %v, want going away", err)
		}
		break
	}
}

func TestPlayersVoteAndAdvanceReview(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	code := host.createLobby("Alice")
	cats := host.lastLobby.Categories
	join := func(name string) *testConn {
		c := dial(t, srv)
		c.send("joinLobby", map[string]any{"playerName": name, "lobbyCode": code})
		var sc struct {
			SessionID string `json:"sessionId"`
		}
		json.Unmarshal(c.waitFor("sessionCreated"), &sc)
		c.sessionID = sc.SessionID
		c.readLobby()
		return c
	}
	bob, carol := join("Bob"), join("Carol")

	excluded := []string{}
	for r := 'B'; r <= 'Z'; r++ {
		excluded = append(excluded, string(r))
	}
	host.send("updateSettings", map[string]any{"timeLimit": nil, "excludedLetters": excluded})
	host.send("startGame", map[string]any{})
	var gs struct {
		State   string `json:"state"`
		RoundID string `json:"roundId"`
	}
	for gs.State != "Playing" {
		json.Unmarshal(host.waitFor("gameState"), &gs)
	}
	host.send("answerUpdate", map[string]any{"categoryId": cats[0].ID, "value": "Aachen", "roundId": gs.RoundID})
	bob.send("answerUpdate", map[string]any{"categoryId": cats[0].ID, "value": "Amsterdam", "roundId": gs.RoundID})
	host.send("endRound", map[string]any{})

	type review struct {
		CategoryIndex int      `json:"categoryIndex"`
		Ready         []string `json:"ready"`
		Voters        []string `json:"voters"`
		Answers       []struct {
			PlayerID string `json:"playerId"`
			Valid    bool   `json:"valid"`
		} `json:"answers"`
	}
	read := func() review {
		var rs review
		json.Unmarshal(host.waitFor("reviewState"), &rs)
		return rs
	}
	valid := func(rs review, pid string) bool {
		for _, a := range rs.Answers {
			if a.PlayerID == pid {
				return a.Valid
			}
		}
		t.Fatalf("no answer for %s", pid)
		return false
	}
	alice := host.lastLobby.Players[0].ID
	if rs := read(); len(rs.Voters) != 3 || !valid(rs, alice) {
		t.Fatalf("unexpected start %+v", rs)
	}

	host.send("voteAnswer", map[string]any{"answerId": alice, "vote": -1})
	bob.send("voteAnswer", map[string]any{"answerId": alice, "vote": -1})
	if rs := read(); valid(rs, alice) {
		t.Fatal("a down vote must reject the answer")
	}
	carol.send("voteAnswer", map[string]any{"answerId": alice, "vote": 1})
	if rs := read(); valid(rs, alice) {
		t.Fatal("a tie must reject the answer")
	}
	host.send("setAnswerValidity", map[string]any{"answerId": alice, "valid": true})
	if rs := read(); !valid(rs, alice) {
		t.Fatal("the host override must win")
	}

	for _, c := range []*testConn{host, bob} {
		c.send("reviewReady", map[string]any{})
		read()
	}
	carol.send("reviewReady", map[string]any{})
	if rs := read(); rs.CategoryIndex != 0 || len(rs.Ready) != 3 {
		t.Fatalf("the last tick must show before moving on, got %+v", rs)
	}
	if rs := read(); rs.CategoryIndex != 1 || len(rs.Ready) != 0 {
		t.Fatalf("expected the next category, got %+v", rs)
	}

	if len(cats) < 3 {
		t.Fatalf("need 3 categories, got %d", len(cats))
	}
	for _, c := range []*testConn{host, bob} {
		c.send("reviewReady", map[string]any{})
		read()
	}
	time.Sleep(2 * reviewHold)
	carol.conn.Close(websocket.StatusNormalClosure, "")
	for {
		if rs := read(); rs.CategoryIndex == 2 {
			break
		}
	}
}

func TestSoloSprint(t *testing.T) {
	srv := newServer(t)
	host := dial(t, srv)
	host.createLobby("Alice")
	if !host.lastLobby.Solo {
		t.Fatal("a lone player should be solo")
	}

	excluded := []string{}
	for r := 'C'; r <= 'Z'; r++ {
		excluded = append(excluded, string(r))
	}
	host.send("updateSettings", map[string]any{"timeLimit": nil, "excludedLetters": excluded})
	host.readLobby()
	host.send("startGame", map[string]any{})
	var gs struct {
		State   string   `json:"state"`
		RoundID string   `json:"roundId"`
		Letters []string `json:"letters"`
	}
	for gs.State != "Playing" {
		json.Unmarshal(host.waitFor("gameState"), &gs)
	}
	if len(gs.Letters) != 2 {
		t.Fatalf("expected the sprint letters A and B, got %v", gs.Letters)
	}
	a, b := gs.Letters[0], gs.Letters[1]
	word := func(pos int, value string) {
		host.send("sprintWord", map[string]any{"roundId": gs.RoundID, "pos": pos, "value": value})
	}
	word(0, a+"stadt")
	word(1, "")
	word(2, a+"fluss")
	word(2, a+"again")
	word(3, a+"wrong")
	word(3, b+"x")
	host.send("ping", map[string]any{})
	host.waitFor("pong")

	again := dial(t, srv)
	again.sessionID = host.sessionID
	again.send("reconnect", map[string]any{})
	var replay struct {
		SprintPos   int      `json:"sprintPos"`
		SprintWords []string `json:"sprintWords"`
	}
	json.Unmarshal(again.waitFor("gameState"), &replay)
	if replay.SprintPos != 4 || len(replay.SprintWords) != 4 || replay.SprintWords[1] != "" || replay.SprintWords[3] != b+"x" {
		t.Fatalf("unexpected replay %+v", replay)
	}

	again.send("sprintWord", map[string]any{"roundId": gs.RoundID, "pos": 4, "value": ""})
	again.send("sprintWord", map[string]any{"roundId": gs.RoundID, "pos": 5, "value": ""})
	var res struct {
		IsGameOver bool `json:"isGameOver"`
		Ranking    []struct {
			Score int `json:"score"`
		} `json:"ranking"`
	}
	json.Unmarshal(again.waitFor("roundResult"), &res)
	if !res.IsGameOver {
		t.Fatal("an untimed sprint ends after the last prompt")
	}
	want := 5 * (game.WordValue(a+"stadt") + game.WordValue(a+"fluss") + game.WordValue(b+"x"))
	if res.Ranking[0].Score != want {
		t.Fatalf("expected score %d, got %+v", want, res.Ranking)
	}
}
