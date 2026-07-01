package websocket

import (
	"encoding/json"
	"log/slog"
	"sort"
	"strings"
	"sync"

	"slf/internal/game"
)

// Resource caps to bound memory use. Deliberately far above any realistic game
// so normal players never hit them; they exist only to stop abuse.
const (
	maxLobbies            = 10000
	maxPlayersPerLobby    = 200
	maxCategoriesPerLobby = 100
)

type Hub struct {
	mu       sync.Mutex
	pending  map[*Client]struct{}
	clients  map[string]*Client       // sessionId → client
	sessions map[string]*game.Session // sessionId → session
	rooms    *RoomManager
}

func NewHub() *Hub {
	return &Hub{
		pending:  make(map[*Client]struct{}),
		clients:  make(map[string]*Client),
		sessions: make(map[string]*game.Session),
		rooms:    NewRoomManager(),
	}
}

// uniqueLobbyCode returns a 6-digit code that is not currently in use.
// Caller must hold h.mu (it reads the room map).
func (h *Hub) uniqueLobbyCode() string {
	for {
		code := generateLobbyCode()
		if _, exists := h.rooms.Get(code); !exists {
			return code
		}
	}
}

func (h *Hub) addPending(c *Client) {
	h.mu.Lock()
	h.pending[c] = struct{}{}
	h.mu.Unlock()
}

func (h *Hub) registerSession(c *Client, session *game.Session) {
	h.mu.Lock()
	delete(h.pending, c)
	// If this socket was already bound to a different session (abnormal — a client
	// creating/joining again without leaving), release the old binding so its
	// lobby doesn't linger with a phantom-connected player and can be reaped.
	if old := c.sessionID; old != "" && old != session.ID && h.clients[old] == c {
		delete(h.clients, old)
		if s, ok := h.sessions[old]; ok {
			if r, ok := h.rooms.Get(s.LobbyCode); ok {
				if p, ok := r.Players[s.PlayerID]; ok {
					p.Connected = false
				}
			}
		}
	}
	h.clients[session.ID] = c
	h.sessions[session.ID] = session
	h.mu.Unlock()
	c.sessionID = session.ID
}

func (h *Hub) onDisconnect(c *Client) {
	h.mu.Lock()
	delete(h.pending, c)

	var lobby *game.Lobby
	// Only tear down if the map still points at *this* connection. If the player
	// already reconnected on a newer socket, h.clients[sessionID] is that newer
	// client — a stale old socket closing must not evict it or mark the player
	// offline (reconnect race).
	if c.sessionID != "" {
		if cur, ok := h.clients[c.sessionID]; ok && cur == c {
			delete(h.clients, c.sessionID)
			if s, ok := h.sessions[c.sessionID]; ok {
				if r, ok := h.rooms.Get(s.LobbyCode); ok {
					lobby = r
					if p, ok := r.Players[s.PlayerID]; ok {
						p.Connected = false
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
	}
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
	var targets []*Client
	for _, p := range lobby.Players {
		if c, ok := h.clients[p.SessionID]; ok {
			targets = append(targets, c)
		}
		delete(h.sessions, p.SessionID)
		delete(h.clients, p.SessionID)
	}
	h.rooms.Delete(lobby.Code)
	msg, _ := json.Marshal(OutboundMessage{
		Type:    "lobbyClosed",
		Payload: map[string]string{"reason": reason},
	})
	h.mu.Unlock()

	for _, c := range targets {
		c.sessionID = ""
		_ = c.writeRaw(msg)
	}
}

func (h *Hub) broadcastLobbyState(lobby *game.Lobby) {
	h.mu.Lock()
	players := make([]game.LobbyPlayer, 0, len(lobby.Players))
	for _, p := range lobby.Players {
		players = append(players, game.LobbyPlayer{
			ID:        p.ID,
			Name:      p.Name,
			IsHost:    p.IsHost,
			Connected: p.Connected,
			Left:      p.Left,
			Score:     p.Score,
		})
	}
	// Stable, alphabetical order so the list never reshuffles on unrelated
	// updates (e.g. a settings change). Tie-break on ID for determinism.
	sort.Slice(players, func(i, j int) bool {
		ni, nj := strings.ToLower(players[i].Name), strings.ToLower(players[j].Name)
		if ni != nj {
			return ni < nj
		}
		return players[i].ID < players[j].ID
	})
	payload := game.LobbyStatePayload{
		LobbyCode:  lobby.Code,
		HostID:     lobby.HostID,
		Players:    players,
		Categories: lobby.Categories,
		Settings:   lobby.Settings,
		State:      lobby.State,
	}
	msg, targets := h.prepareBroadcast(lobby, "lobbyState", payload)
	h.mu.Unlock()

	writeAll(targets, msg)
}

func (h *Hub) sendError(c *Client, code ErrorCode, message string) {
	severity := severityOf(code)
	if severity == "critical" {
		slog.Error("critical error", "code", string(code), "session", c.sessionID, "message", message)
	}
	c.send("error", errorPayload{Code: code, Message: message, Severity: severity})
}
