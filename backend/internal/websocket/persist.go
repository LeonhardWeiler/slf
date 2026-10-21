package websocket

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"time"

	"slf/internal/game"
)

type savedLobby struct {
	*game.Lobby
	Players    map[string]*game.Player  `json:"players"`
	Game       *game.Game               `json:"game"`
	LastResult *game.RoundResultPayload `json:"lastResult"`
}

func idle(lobby *game.Lobby) bool {
	return lobby.State == game.StateLobby || lobby.State == game.StateGameOver
}

// Drain refuses new games and returns once no lobby is mid-game, or when ctx ends.
func (h *Hub) Drain(ctx context.Context) {
	h.mu.Lock()
	h.draining = true
	h.mu.Unlock()
	for {
		h.mu.Lock()
		busy := false
		for _, lobby := range h.rooms.All() {
			busy = busy || !idle(lobby)
		}
		h.mu.Unlock()
		if !busy {
			return
		}
		select {
		case <-ctx.Done():
			return
		case <-time.After(time.Second):
		}
	}
}

// Save writes every idle lobby to path so Load can restore it after a restart.
func (h *Hub) Save(path string) error {
	h.mu.Lock()
	var saved []savedLobby
	for _, lobby := range h.rooms.All() {
		if !idle(lobby) {
			continue
		}
		s := savedLobby{Lobby: lobby, Players: lobby.Players, Game: lobby.Game}
		if lobby.Game != nil {
			s.LastResult = lobby.Game.LastResult
		}
		saved = append(saved, s)
	}
	data, err := json.Marshal(saved)
	h.mu.Unlock()
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

// Load restores the lobbies written by Save and removes the file.
func (h *Hub) Load(path string) error {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	os.Remove(path)
	var saved []savedLobby
	if err := json.Unmarshal(data, &saved); err != nil {
		return err
	}
	h.mu.Lock()
	for _, s := range saved {
		lobby := s.Lobby
		lobby.Players = s.Players
		lobby.Game = s.Game
		if lobby.Game != nil {
			lobby.Game.LastResult = s.LastResult
		}
		for _, p := range lobby.Players {
			p.Connected = false
			if !p.Left {
				h.sessions[p.SessionID] = &game.Session{ID: p.SessionID, PlayerID: p.ID, LobbyCode: lobby.Code}
			}
		}
		h.rooms.Create(lobby)
	}
	h.mu.Unlock()
	for _, s := range saved {
		h.startHostGrace(s.Lobby)
	}
	return nil
}
