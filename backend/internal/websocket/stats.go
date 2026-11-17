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
