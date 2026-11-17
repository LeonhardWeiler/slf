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

// endEvent is the end event of a game that is not over yet, else nil. Caller
// holds hub.mu and passes it to Stats.Add after unlocking.
func endEvent(lobby *game.Lobby, reason string) *stats.Event {
	if lobby.Game == nil || lobby.State == game.StateGameOver {
		return nil
	}
	e := gameEvent("end", lobby)
	e.Reason = reason
	return &e
}
