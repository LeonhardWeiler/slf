package websocket

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"os"
	"slices"
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

// restorable lobbies are saved on shutdown; the others are mid-round.
func restorable(lobby *game.Lobby) bool {
	return idle(lobby) || lobby.State == game.StateRoundResult
}

// Drain refuses new games and rounds and returns once no round is being
// played, or when ctx ends.
func (h *Hub) Drain(ctx context.Context) {
	h.mu.Lock()
	h.draining = true
	h.mu.Unlock()
	for {
		h.mu.Lock()
		busy := false
		for _, lobby := range h.rooms.All() {
			busy = busy || !restorable(lobby) && slices.ContainsFunc(slices.Collect(maps.Values(lobby.Players)), func(p *game.Player) bool { return p.Connected })
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

// Save writes every restorable lobby to path so Load can restore it after a restart.
func (h *Hub) Save(path string) error {
	h.mu.Lock()
	var saved []savedLobby
	for _, lobby := range h.rooms.All() {
		if !restorable(lobby) {
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
	tmp := path + ".tmp"
	f, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		return err
	}
	_, err = f.Write(data)
	if err == nil {
		err = f.Sync()
	}
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, path)
}

// Load restores the lobbies written by Save and removes the file. A file that
// does not parse is kept as path.broken.
func (h *Hub) Load(path string) error {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	var saved []savedLobby
	if err := json.Unmarshal(data, &saved); err != nil {
		os.Rename(path, path+".broken")
		return fmt.Errorf("parse %s: %w", path, err)
	}
	os.Remove(path)
	saved = slices.DeleteFunc(saved, func(s savedLobby) bool {
		if s.Lobby == nil || s.Code == "" || len(s.Players) == 0 {
			return true
		}
		return slices.ContainsFunc(slices.Collect(maps.Values(s.Players)), func(p *game.Player) bool { return p == nil })
	})
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
		h.startHostGrace(s.Lobby, lobbyTTL)
	}
	return nil
}
