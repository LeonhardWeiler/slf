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
	"slf/internal/stats"
)

// Resource caps against abuse, far above any realistic game.
const (
	maxLobbies         = 2000
	maxConnections     = 2000
	maxPlayersPerLobby = 200
)

// maxCategoriesPerLobby is a game rule, mirrored as MAX_CATEGORIES in Lobby.tsx.
const maxCategoriesPerLobby = 20

const (
	lobbyTTL        = 10 * time.Minute
	janitorInterval = 2 * time.Minute
)

const hostGraceSeconds = 15

type Hub struct {
	mu        sync.Mutex
	pending   map[*Client]struct{}
	clients   map[string]*Client       // sessionId -> client
	sessions  map[string]*game.Session // sessionId -> session
	rooms     map[string]*game.Lobby
	hostGrace map[string]*time.Timer
	// hostGraceDuration is how long the grace lasts; overridable in tests.
	hostGraceDuration time.Duration
	// pingInterval spaces the server heartbeat; overridable in tests.
	pingInterval time.Duration
	// Stats records usage events; nil turns them off.
	Stats *stats.Log
	// draining refuses new games while the server waits to restart for an update.
	draining bool
	// closed refuses new sockets and messages once Shutdown began.
	closed atomic.Bool
	// drops counts clients closed for a full send queue.
	drops atomic.Int64
}

func NewHub() *Hub {
	return &Hub{
		pending:           make(map[*Client]struct{}),
		clients:           make(map[string]*Client),
		sessions:          make(map[string]*game.Session),
		rooms:             make(map[string]*game.Lobby),
		hostGrace:         make(map[string]*time.Timer),
		hostGraceDuration: hostGraceSeconds * time.Second,
		pingInterval:      pingInterval,
	}
}

// Guarded by the hub mutex so it happens-before the reader.
func (h *Hub) setHostGraceDuration(d time.Duration) {
	h.mu.Lock()
	h.hostGraceDuration = d
	h.mu.Unlock()
}

// The hub state is frozen after Shutdown and safe to Save.
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

func (h *Hub) Counters() map[string]int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return map[string]int{
		"Lobbys":  len(h.rooms),
		"Sockets": len(h.clients) + len(h.pending),
		"Drops":   int(h.drops.Load()),
	}
}

func (h *Hub) StartJanitor() {
	go func() {
		t := time.NewTicker(janitorInterval)
		defer t.Stop()
		for range t.C {
			h.reapAbandoned()
		}
	}()
}

// EmptySince is owned entirely by reapAbandoned.
func (h *Hub) reapAbandoned() {
	now := time.Now()
	var toReap []*game.Lobby
	h.mu.Lock()
	for _, lobby := range h.rooms {
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

// Caller must hold h.mu.
func (h *Hub) uniqueLobbyCode() string {
	for {
		code := generateLobbyCode()
		if _, exists := h.rooms[code]; !exists {
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

// endSessionLocked drops a session for good; its socket stays open and goes
// back to pending. Caller must hold h.mu.
func (h *Hub) endSessionLocked(sessionID string) {
	delete(h.sessions, sessionID)
	if c, ok := h.clients[sessionID]; ok {
		delete(h.clients, sessionID)
		c.sessionID = ""
		h.pending[c] = struct{}{}
	}
}

// bindLocked returns the socket it replaces. Caller must hold h.mu.
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
	hostDropped, reviewing := false, false
	// Only tear down if the map still points at *this* connection. If the player
	// already reconnected on a newer socket, h.clients[sessionID] is that newer
	// client - a stale old socket closing must not evict it or mark the player
	// offline (reconnect race).
	if c.sessionID != "" {
		if cur, ok := h.clients[c.sessionID]; ok && cur == c {
			delete(h.clients, c.sessionID)
			if s, ok := h.sessions[c.sessionID]; ok {
				if r, ok := h.rooms[s.LobbyCode]; ok {
					lobby = r
					if p, ok := r.Players[s.PlayerID]; ok {
						p.Connected = false
						hostDropped = p.IsHost
						reviewing = r.State == game.StateReviewing
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
		if reviewing {
			h.broadcastReviewState(lobby)
		}
		if hostDropped {
			h.startHostGrace(lobby, h.hostGraceDuration)
		}
	}
}

// Caller must hold h.mu.
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

func (h *Hub) startHostGrace(lobby *game.Lobby, d time.Duration) {
	h.mu.Lock()
	if _, running := h.hostGrace[lobby.Code]; running {
		h.mu.Unlock()
		return
	}
	if host, ok := lobby.Players[lobby.HostID]; ok && host.Connected {
		h.mu.Unlock()
		return
	}
	code := lobby.Code
	lobby.HostGraceUntil = time.Now().Add(d)
	h.hostGrace[code] = time.AfterFunc(d, func() {
		h.onHostGraceExpired(code)
	})
	graceSeconds := *graceSecondsLeft(lobby) // ceil of the (just-set) remaining
	slog.Info("host disconnected, grace started", "lobby", code, "seconds", graceSeconds)
	h.mu.Unlock()

	h.broadcastTo(lobby, "hostDisconnected", map[string]int{"graceSeconds": graceSeconds})
}

func (h *Hub) cancelHostGrace(code string) bool {
	h.mu.Lock()
	t, ok := h.hostGrace[code]
	if ok {
		t.Stop()
		delete(h.hostGrace, code)
		if lobby, found := h.rooms[code]; found {
			lobby.HostGraceUntil = time.Time{}
		}
	}
	h.mu.Unlock()
	return ok
}

func (h *Hub) onHostGraceExpired(code string) {
	h.mu.Lock()
	delete(h.hostGrace, code)
	lobby, ok := h.rooms[code]
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

// The caller MUST hold h.mu.
func (h *Hub) playerForLocked(c *Client) *game.Player {
	s, ok := h.sessions[c.sessionID]
	if !ok {
		return nil
	}
	lobby, ok := h.rooms[s.LobbyCode]
	if !ok {
		return nil
	}
	return lobby.Players[s.PlayerID]
}

// The caller MUST hold h.mu.
func (h *Hub) lookupLocked(sessionID string) (*game.Session, *game.Lobby, *game.Player, bool) {
	s, ok := h.sessions[sessionID]
	if !ok {
		return nil, nil, nil, false
	}
	lobby, ok := h.rooms[s.LobbyCode]
	if !ok {
		return nil, nil, nil, false
	}
	player, ok := lobby.Players[s.PlayerID]
	if !ok {
		return nil, nil, nil, false
	}
	return s, lobby, player, true
}

func (h *Hub) closeLobby(lobby *game.Lobby, reason string) {
	slog.Info("lobby closed", "lobby", lobby.Code, "reason", reason)
	h.mu.Lock()
	ev := endEvent(lobby, reason)
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
			c.enqueue("lobbyClosed", msg)
		}
		h.endSessionLocked(p.SessionID)
	}
	delete(h.rooms, lobby.Code)
	h.mu.Unlock()
	h.Stats.Add(ev)
}

func (h *Hub) broadcastLobbyState(lobby *game.Lobby) {
	h.mu.Lock()
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
				Plays:     playsThisRound(lobby, p),
				Score:     p.Score,
				Combo:     p.Combo,
			},
		})
	}
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
		Solo:             soloGame(lobby),
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

// Caller must NOT hold h.mu.
func (h *Hub) sessionIDOf(c *Client) string {
	h.mu.Lock()
	defer h.mu.Unlock()
	return c.sessionID
}

// sendError is called without h.mu held.
func (h *Hub) sendError(c *Client, code ErrorCode, message string) {
	severity := severityOf(code)
	if severity == "critical" {
		slog.Info("session error", "code", string(code), "session", hashSession(h.sessionIDOf(c)), "message", message)
	}
	c.send("error", errorPayload{Code: code, Message: message, Severity: severity})
}
