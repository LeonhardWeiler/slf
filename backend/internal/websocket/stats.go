package websocket

import (
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
	if lobby.State == game.StatePlaying || lobby.State == game.StateReviewing {
		e.Rounds--
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

// recordEndLocked logs the end of a game that is not over yet. Caller must
// hold hub.mu.
func (hub *Hub) recordEndLocked(lobby *game.Lobby, reason string) {
	if lobby.Game == nil || lobby.State == game.StateGameOver {
		return
	}
	e := gameEvent("end", lobby)
	e.Reason = reason
	hub.Stats.Add(e)
}
