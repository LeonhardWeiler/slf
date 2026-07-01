package websocket

import (
	"context"
	"encoding/json"
	"sort"
	"strings"
	"sync"

	"github.com/coder/websocket"
	"slf/internal/game"
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

func (h *Hub) addPending(c *Client) {
	h.mu.Lock()
	h.pending[c] = struct{}{}
	h.mu.Unlock()
}

func (h *Hub) registerSession(c *Client, session *game.Session) {
	h.mu.Lock()
	delete(h.pending, c)
	h.clients[session.ID] = c
	h.sessions[session.ID] = session
	h.mu.Unlock()
	c.sessionID = session.ID
}

func (h *Hub) onDisconnect(c *Client) {
	h.mu.Lock()
	delete(h.pending, c)

	var lobby *game.Lobby
	if c.sessionID != "" {
		delete(h.clients, c.sessionID)
		if s, ok := h.sessions[c.sessionID]; ok {
			if r, ok := h.rooms.Get(s.LobbyCode); ok {
				lobby = r
				if p, ok := r.Players[s.PlayerID]; ok {
					p.Connected = false
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
	players := make([]*game.Player, 0, len(lobby.Players))
	for _, p := range lobby.Players {
		cp := *p
		players = append(players, &cp)
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
	msg, _ := json.Marshal(OutboundMessage{Type: "lobbyState", Payload: payload})

	var targets []*Client
	for _, p := range lobby.Players {
		if c, ok := h.clients[p.SessionID]; ok {
			targets = append(targets, c)
		}
	}
	h.mu.Unlock()

	for _, c := range targets {
		_ = c.writeRaw(msg)
	}
}

func (h *Hub) sendTo(sessionID string, msgType string, payload any) {
	h.mu.Lock()
	c, ok := h.clients[sessionID]
	h.mu.Unlock()
	if ok {
		c.send(msgType, payload)
	}
}

func (h *Hub) sendError(c *Client, code ErrorCode, message string) {
	c.send("error", errorPayload{Code: code, Message: message, Severity: severityOf(code)})
}

func (h *Hub) writeRawTo(c *Client, msg []byte) {
	_ = c.conn.Write(context.Background(), websocket.MessageText, msg)
}
