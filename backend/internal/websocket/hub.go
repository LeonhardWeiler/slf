package websocket

import (
	"encoding/json"
	"log/slog"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"slf/internal/game"
)

// Resource caps to bound memory use. Deliberately far above any realistic game
// so normal players never hit them; they exist only to stop abuse.
const (
	maxLobbies         = 2000
	maxConnections     = 2000
	maxPlayersPerLobby = 200
)

// maxCategoriesPerLobby is a game rule, mirrored as MAX_CATEGORIES in Lobby.tsx.
const maxCategoriesPerLobby = 20

// Abandoned-lobby reaper timing: a lobby with zero connected players for longer
// than lobbyTTL is closed. Checked every janitorInterval.
const (
	lobbyTTL        = 10 * time.Minute
	janitorInterval = 2 * time.Minute
)

// hostGraceSeconds is how long the lobby waits for a disconnected host to come
// back before it is closed (SRS 4.6/8.5). All players see a live countdown.
const hostGraceSeconds = 15

type Hub struct {
	mu       sync.Mutex
	pending  map[*Client]struct{}
	clients  map[string]*Client       // sessionId -> client
	sessions map[string]*game.Session // sessionId -> session
	rooms    *RoomManager
	// hostGrace holds the running grace timer per lobby code while its host is
	// disconnected; cancelled on host reconnect, fired -> lobby closed.
	hostGrace map[string]*time.Timer
	// hostGraceDuration is how long the grace lasts; overridable in tests.
	hostGraceDuration time.Duration
	// pingInterval spaces the server heartbeat; overridable in tests.
	pingInterval time.Duration
	// draining refuses new games while the server waits to restart for an update.
	draining bool
	// closed refuses new sockets and messages once Shutdown began.
	closed atomic.Bool
}

func NewHub() *Hub {
	return &Hub{
		pending:           make(map[*Client]struct{}),
		clients:           make(map[string]*Client),
		sessions:          make(map[string]*game.Session),
		rooms:             NewRoomManager(),
		hostGrace:         make(map[string]*time.Timer),
		hostGraceDuration: hostGraceSeconds * time.Second,
		pingInterval:      pingInterval,
	}
}

// setHostGraceDuration overrides the grace window (used by tests to avoid waiting
// the full 15s). Guarded by the hub mutex so it happens-before the reader.
func (h *Hub) setHostGraceDuration(d time.Duration) {
	h.mu.Lock()
	h.hostGraceDuration = d
	h.mu.Unlock()
}

// Shutdown stops taking connections and messages, then closes every open
// WebSocket in parallel with a 1001 (going away) frame so clients reconnect
// with backoff. The hub state is frozen afterwards and safe to Save.
func (h *Hub) Shutdown() {
	h.closed.Store(true)
	h.mu.Lock()
	conns := make([]*Client, 0, len(h.clients)+len(h.pending))
	for _, c := range h.clients {
		conns = append(conns, c)
	}
	for c := range h.pending {
		conns = append(conns, c)
	}
	h.mu.Unlock()
	var wg sync.WaitGroup
	for _, c := range conns {
		wg.Go(c.closeGoingAway)
	}
	wg.Wait()
}

// Health reports whether the hub lock is obtainable within d (the game loop is
// not stuck) and whether the hub drains for a restart.
func (h *Hub) Health(d time.Duration) (live, draining bool) {
	done := make(chan bool, 1)
	go func() {
		h.mu.Lock()
		done <- h.draining
		h.mu.Unlock()
	}()
	select {
	case draining = <-done:
		return true, draining
	case <-time.After(d):
		return false, false
	}
}

// StartJanitor launches the background reaper that closes abandoned lobbies.
func (h *Hub) StartJanitor() {
	go func() {
		t := time.NewTicker(janitorInterval)
		defer t.Stop()
		for range t.C {
			h.reapAbandoned()
		}
	}()
}

// reapAbandoned closes lobbies that have had no connected player for longer than
// lobbyTTL. EmptySince is owned entirely here, so it always tracks the real
// connection state and needs no updates elsewhere.
func (h *Hub) reapAbandoned() {
	now := time.Now()
	var toReap []*game.Lobby
	h.mu.Lock()
	for _, lobby := range h.rooms.All() {
		connected := 0
		for _, p := range lobby.Players {
			if _, ok := h.clients[p.SessionID]; ok {
				connected++
			}
		}
		if connected > 0 {
			lobby.EmptySince = time.Time{}
			continue
		}
		if lobby.EmptySince.IsZero() {
			lobby.EmptySince = now
		} else if now.Sub(lobby.EmptySince) >= lobbyTTL {
			toReap = append(toReap, lobby)
		}
	}
	h.mu.Unlock()

	for _, lobby := range toReap {
		h.closeLobby(lobby, "abandoned")
	}
}

// uniqueLobbyCode returns a 6-char [a-z0-9] code that is not currently in use.
// Caller must hold h.mu (it reads the room map).
func (h *Hub) uniqueLobbyCode() string {
	for {
		code := generateLobbyCode()
		if _, exists := h.rooms.Get(code); !exists {
			return code
		}
	}
}

func (h *Hub) addPending(c *Client) bool {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.closed.Load() || len(h.pending)+len(h.clients) >= maxConnections {
		return false
	}
	h.pending[c] = struct{}{}
	return true
}

func (h *Hub) registerSession(c *Client, session *game.Session) {
	h.releaseSeat(c, session.ID)
	h.mu.Lock()
	h.sessions[session.ID] = session
	h.bindLocked(c, session.ID)
	h.mu.Unlock()
}

// releaseSeat frees the seat a socket holds before it binds to another
// session, exactly as if that connection had dropped.
func (h *Hub) releaseSeat(c *Client, sessionID string) {
	if c.sessionID == "" || c.sessionID == sessionID {
		return
	}
	h.onDisconnect(c)
	h.mu.Lock()
	c.sessionID = ""
	h.pending[c] = struct{}{}
	h.mu.Unlock()
}

// bindLocked binds the socket to a session and returns the socket it replaces.
// Caller must hold h.mu.
func (h *Hub) bindLocked(c *Client, sessionID string) *Client {
	old := h.clients[sessionID]
	delete(h.pending, c)
	h.clients[sessionID] = c
	c.sessionID = sessionID
	c.lobbyBase = ""
	return old
}

func (h *Hub) onDisconnect(c *Client) {
	h.mu.Lock()
	delete(h.pending, c)

	var lobby *game.Lobby
	hostDropped := false
	// Only tear down if the map still points at *this* connection. If the player
	// already reconnected on a newer socket, h.clients[sessionID] is that newer
	// client - a stale old socket closing must not evict it or mark the player
	// offline (reconnect race).
	if c.sessionID != "" {
		if cur, ok := h.clients[c.sessionID]; ok && cur == c {
			delete(h.clients, c.sessionID)
			if s, ok := h.sessions[c.sessionID]; ok {
				if r, ok := h.rooms.Get(s.LobbyCode); ok {
					lobby = r
					if p, ok := r.Players[s.PlayerID]; ok {
						p.Connected = false
						hostDropped = p.IsHost
						slog.Info("player disconnected",
							"lobby", r.Code, "player", p.Name, "host", p.IsHost)
					}
				}
			}
		}
	}
	h.mu.Unlock()

	if lobby != nil {
		h.broadcastLobbyState(lobby)
		if hostDropped {
			h.startHostGrace(lobby)
		}
	}
}

// graceSecondsLeft returns the seconds until the host-grace deadline (rounded
// up), or nil when no grace is active. Caller must hold h.mu.
func graceSecondsLeft(lobby *game.Lobby) *int {
	if lobby.HostGraceUntil.IsZero() {
		return nil
	}
	d := time.Until(lobby.HostGraceUntil)
	secs := int(d / time.Second)
	if d%time.Second > 0 {
		secs++
	}
	if secs < 0 {
		secs = 0
	}
	return &secs
}

// startHostGrace begins the countdown after the host's connection dropped. All
// clients are told so they can show a shared countdown; if the host does not
// reconnect within hostGraceSeconds, the lobby is closed.
func (h *Hub) startHostGrace(lobby *game.Lobby) {
	h.mu.Lock()
	if _, running := h.hostGrace[lobby.Code]; running {
		h.mu.Unlock()
		return
	}
	// If the host is already back (reconnect raced ahead), do nothing.
	if host, ok := lobby.Players[lobby.HostID]; ok && host.Connected {
		h.mu.Unlock()
		return
	}
	code := lobby.Code
	lobby.HostGraceUntil = time.Now().Add(h.hostGraceDuration)
	h.hostGrace[code] = time.AfterFunc(h.hostGraceDuration, func() {
		h.onHostGraceExpired(code)
	})
	graceSeconds := *graceSecondsLeft(lobby) // ceil of the (just-set) remaining
	slog.Info("host disconnected, grace started", "lobby", code, "seconds", graceSeconds)
	h.mu.Unlock()

	h.broadcastTo(lobby, "hostDisconnected", map[string]int{"graceSeconds": graceSeconds})
}

// cancelHostGrace stops a running grace timer (host came back). Returns true if
// a timer was actually cancelled.
func (h *Hub) cancelHostGrace(code string) bool {
	h.mu.Lock()
	t, ok := h.hostGrace[code]
	if ok {
		t.Stop()
		delete(h.hostGrace, code)
		if lobby, found := h.rooms.Get(code); found {
			lobby.HostGraceUntil = time.Time{}
		}
	}
	h.mu.Unlock()
	return ok
}

// onHostGraceExpired fires when the host never reconnected in time -> close.
func (h *Hub) onHostGraceExpired(code string) {
	h.mu.Lock()
	delete(h.hostGrace, code)
	lobby, ok := h.rooms.Get(code)
	if !ok {
		h.mu.Unlock()
		return
	}
	// Guard against a race where the host reconnected just as the timer fired.
	if host, ok := lobby.Players[lobby.HostID]; ok && host.Connected {
		h.mu.Unlock()
		return
	}
	h.mu.Unlock()

	h.closeLobby(lobby, "hostDisconnected")
}

// playerForLocked resolves the player currently bound to a client's session, or
// nil if none. The caller MUST hold h.mu.
func (h *Hub) playerForLocked(c *Client) *game.Player {
	s, ok := h.sessions[c.sessionID]
	if !ok {
		return nil
	}
	lobby, ok := h.rooms.Get(s.LobbyCode)
	if !ok {
		return nil
	}
	return lobby.Players[s.PlayerID]
}

// lookupLocked resolves a session to its lobby and player.
// The caller MUST hold h.mu.
func (h *Hub) lookupLocked(sessionID string) (*game.Session, *game.Lobby, *game.Player, bool) {
	s, ok := h.sessions[sessionID]
	if !ok {
		return nil, nil, nil, false
	}
	lobby, ok := h.rooms.Get(s.LobbyCode)
	if !ok {
		return nil, nil, nil, false
	}
	player, ok := lobby.Players[s.PlayerID]
	if !ok {
		return nil, nil, nil, false
	}
	return s, lobby, player, true
}

// closeLobby destroys a lobby, invalidates all of its sessions and notifies
// every connected player so their clients return to the start screen.
// Used when the host leaves or the lobby is otherwise torn down (SRS 4.8).
func (h *Hub) closeLobby(lobby *game.Lobby, reason string) {
	slog.Info("lobby closed", "lobby", lobby.Code, "reason", reason)
	h.mu.Lock()
	// Stop a pending host-grace timer so it cannot fire against a closed lobby.
	if t, ok := h.hostGrace[lobby.Code]; ok {
		t.Stop()
		delete(h.hostGrace, lobby.Code)
	}
	msg, _ := json.Marshal(OutboundMessage{
		Type:    "lobbyClosed",
		Payload: map[string]string{"reason": reason},
	})
	for _, p := range lobby.Players {
		if c, ok := h.clients[p.SessionID]; ok {
			c.sessionID = ""
			c.enqueue("lobbyClosed", msg)
		}
		delete(h.sessions, p.SessionID)
		delete(h.clients, p.SessionID)
	}
	h.rooms.Delete(lobby.Code)
	h.mu.Unlock()
}

func (h *Hub) broadcastLobbyState(lobby *game.Lobby) {
	h.mu.Lock()
	// Decorate-sort: precompute the lowercased name once per player instead of
	// re-lowering inside the comparator (which runs O(n log n) times and would
	// allocate a fresh string each call).
	type decorated struct {
		key    string // lowercased name, used only for ordering
		player game.LobbyPlayer
	}
	decoratedPlayers := make([]decorated, 0, len(lobby.Players))
	for _, p := range lobby.Players {
		decoratedPlayers = append(decoratedPlayers, decorated{
			key: strings.ToLower(p.Name),
			player: game.LobbyPlayer{
				ID:        p.ID,
				Name:      p.Name,
				IsHost:    p.IsHost,
				Connected: p.Connected,
				Left:      p.Left,
				Pending:   p.Pending,
				Score:     p.Score,
				Combo:     p.Combo,
			},
		})
	}
	// Stable, alphabetical order so the list never reshuffles on unrelated
	// updates (e.g. a settings change). Tie-break on ID for determinism.
	slices.SortFunc(decoratedPlayers, func(a, b decorated) int {
		if a.key != b.key {
			return strings.Compare(a.key, b.key)
		}
		return strings.Compare(a.player.ID, b.player.ID)
	})
	players := make([]game.LobbyPlayer, len(decoratedPlayers))
	for i := range decoratedPlayers {
		players[i] = decoratedPlayers[i].player
	}
	payload := game.LobbyStatePayload{
		LobbyCode:        lobby.Code,
		HostID:           lobby.HostID,
		Players:          players,
		Categories:       lobby.Categories,
		Settings:         lobby.Settings,
		State:            lobby.State,
		HostGraceSeconds: graceSecondsLeft(lobby),
		Solo:             soloPlayer(lobby) != nil,
	}
	lobby.Version++
	full, _ := json.Marshal(OutboundMessage{Type: "lobbyState", Payload: payload, StateVersion: lobby.Version})
	var patch []byte
	if lobby.SentPlayers != nil {
		patch, _ = json.Marshal(OutboundMessage{Type: "lobbyPatch", Payload: lobbyPatch(lobby.SentPlayers, payload), StateVersion: lobby.Version})
	}
	lobby.SentPlayers = players
	for _, p := range lobby.Players {
		cl, ok := h.clients[p.SessionID]
		if !ok {
			continue
		}
		if patch != nil && cl.lobbyBase == cl.sessionID {
			cl.enqueue("lobbyPatch", patch)
		} else {
			cl.enqueue("lobbyState", full)
		}
		cl.lobbyBase = cl.sessionID
	}
	h.mu.Unlock()
}

// lobbyPatch reduces next to the players that differ from prev.
func lobbyPatch(prev []game.LobbyPlayer, next game.LobbyStatePayload) game.LobbyPatchPayload {
	old := make(map[string]game.LobbyPlayer, len(prev))
	for _, p := range prev {
		old[p.ID] = p
	}
	patch := game.LobbyPatchPayload{LobbyStatePayload: next, Removed: []string{}}
	patch.Players = []game.LobbyPlayer{}
	for _, p := range next.Players {
		if o, ok := old[p.ID]; !ok || o != p {
			patch.Players = append(patch.Players, p)
		}
		delete(old, p.ID)
	}
	for id := range old {
		patch.Removed = append(patch.Removed, id)
	}
	return patch
}

// sessionIDOf reads a client's session id under h.mu, for the few paths that
// need it outside a handler's own critical section. Caller must NOT hold h.mu.
func (h *Hub) sessionIDOf(c *Client) string {
	h.mu.Lock()
	defer h.mu.Unlock()
	return c.sessionID
}

// sendError reports a failure to one client. Always called after the caller
// released h.mu, so the (rare) critical-path log takes the lock itself rather
// than reading sessionID unguarded.
func (h *Hub) sendError(c *Client, code ErrorCode, message string) {
	severity := severityOf(code)
	if severity == "critical" {
		slog.Error("critical error", "code", string(code), "session", hashSession(h.sessionIDOf(c)), "message", message)
	}
	c.send("error", errorPayload{Code: code, Message: message, Severity: severity})
}
