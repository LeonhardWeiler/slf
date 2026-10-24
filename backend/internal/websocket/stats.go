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
// in, and where someone turned sound or music off or left.
func handleTrack(hub *Hub, raw json.RawMessage) {
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
	hub.Stats.Add(stats.Event{Ev: p.Ev, Value: p.Value, Scene: p.Scene})
}
