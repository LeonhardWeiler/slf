package websocket

import (
	"encoding/json"
	"regexp"
	"time"

	"slf/internal/game"
	"slf/internal/stats"
)

func gameEvent(ev string, lobby *game.Lobby) stats.Event {
	e := stats.Event{
		Ev:          ev,
		Mode:        lobby.Game.Mode,
		Rounds:      len(lobby.Game.UsedLetters),
		Seconds:     int(time.Since(lobby.Game.StartedAt).Seconds()),
		Cats:        len(lobby.Categories),
		LastLetter:  lobby.Settings.LastLetterMode,
		Commentator: !lobby.Settings.HostPlays,
	}
	if lobby.Settings.TimeLimit != nil {
		e.Limit = *lobby.Settings.TimeLimit
	}
	for _, p := range lobby.Players {
		if playsThisRound(lobby, p) {
			e.Players++
		}
	}
	return e
}

var trackValue = regexp.MustCompile(`^[a-z]{1,16}$`)

// handleTrack records what only the client knows: the world a round is drawn
// in, and where someone turned sound or music off or left. Each player in a
// lobby counts once per kind and round.
func handleTrack(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		Ev    string `json:"ev"`
		Value string `json:"value"`
		Scene string `json:"scene"`
	}
	if json.Unmarshal(raw, &p) != nil {
		return
	}
	switch p.Ev {
	case "world", "leave", "mute", "musicOff":
	default:
		return
	}
	if p.Value != "" && !trackValue.MatchString(p.Value) || p.Scene != "" && !trackValue.MatchString(p.Scene) {
		return
	}
	hub.mu.Lock()
	_, lobby, _, ok := hub.lookupLocked(c.sessionID)
	key := p.Ev
	if ok && lobby.Game != nil && lobby.Game.Round != nil {
		key += lobby.Game.Round.ID
	}
	seen := !ok || c.tracked[key]
	if !seen {
		if c.tracked == nil {
			c.tracked = map[string]bool{}
		}
		c.tracked[key] = true
	}
	hub.mu.Unlock()
	if seen {
		return
	}
	hub.Stats.Add(stats.Event{Ev: p.Ev, Value: p.Value, Scene: p.Scene})
}
