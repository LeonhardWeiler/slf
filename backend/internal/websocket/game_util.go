package websocket

import (
	"encoding/json"
	"log/slog"
	"sort"
	"time"

	"slf/internal/game"
)

// setLobbyState updates a lobby's state and logs the transition (SRS 12.9).
// Caller must hold hub.mu.
func setLobbyState(lobby *game.Lobby, to game.GameState) {
	if lobby.State != to {
		slog.Info("state transition",
			"lobby", lobby.Code, "from", string(lobby.State), "to", string(to))
	}
	lobby.State = to
}

func categoryExists(lobby *game.Lobby, catID string) bool {
	for _, c := range lobby.Categories {
		if c.ID == catID {
			return true
		}
	}
	return false
}

func storeAnswer(round *game.Round, playerID, catID, value string) {
	// An empty / whitespace-only value is not a real submission, and the server
	// authoritatively enforces the 1–30 char limit (SRS 9.13.14) instead of
	// trusting the client's maxLength: drop the entry in either case so it never
	// shows up as a "submitted" answer in review (and so buzzing still requires
	// every category to be filled).
	norm := game.Normalize(value)
	if norm == "" || len([]rune(norm)) > 30 {
		if byCat, ok := round.Answers[playerID]; ok {
			delete(byCat, catID)
		}
		return
	}
	if round.Answers[playerID] == nil {
		round.Answers[playerID] = map[string]*game.Answer{}
	}
	round.Answers[playerID][catID] = &game.Answer{Value: value}
}

// answerFor returns a player's answer (answerID == playerID) for a category.
func answerFor(round *game.Round, playerID, catID string) *game.Answer {
	if byCat, ok := round.Answers[playerID]; ok {
		return byCat[catID]
	}
	return nil
}

// buildGameState builds the shared round view. Caller must hold hub.mu.
func buildGameState(lobby *game.Lobby) game.GameStatePayload {
	g := lobby.Game
	r := g.Round
	p := game.GameStatePayload{
		RoundID:          r.ID,
		State:            string(lobby.State),
		UsedLetters:      g.UsedLetters,
		RemainingLetters: g.RemainingLetters,
		CategoryCount:    len(lobby.Categories),
	}
	if lobby.State == game.StateCountdown {
		rem := countdownSeconds - int(time.Since(r.StartedAt).Seconds())
		if rem < 0 {
			rem = 0
		}
		p.CountdownRemaining = &rem
		if lobby.Settings.ShowLetterDuringCountdown {
			p.Letter = r.Letter
		}
	} else { // Playing
		p.Letter = r.Letter
		if lobby.Settings.TimeLimit != nil && !r.EndsAt.IsZero() {
			rem := int(time.Until(r.EndsAt).Seconds())
			if rem < 0 {
				rem = 0
			}
			p.TimeRemaining = &rem
		}
		// Elapsed lets a (re)connecting client resume the stopwatch / countdown
		// from the correct position instead of restarting at 0.
		elapsed := int(time.Since(r.StartedAt).Seconds())
		if elapsed < 0 {
			elapsed = 0
		}
		p.Elapsed = &elapsed
	}
	return p
}

// buildReviewState builds the current category's review view (with point
// previews). Caller must hold hub.mu.
func buildReviewState(lobby *game.Lobby) game.ReviewStatePayload {
	r := lobby.Game.Round
	idx := r.ReviewIndex
	if idx < 0 || idx >= len(lobby.Categories) {
		idx = 0
	}
	cat := lobby.Categories[idx]

	perCat := map[string]*game.Answer{}
	for pid, byCat := range r.Answers {
		// Skip players who left the game — they are kept only for the standings.
		if pl, ok := lobby.Players[pid]; ok && pl.Left {
			continue
		}
		if a, ok := byCat[cat.ID]; ok {
			perCat[pid] = a
		}
	}
	game.ScoreCategory(perCat) // sets Points for the preview

	answers := make([]game.ReviewAnswer, 0, len(perCat))
	for pid, a := range perCat {
		answers = append(answers, game.ReviewAnswer{
			AnswerID:      pid,
			PlayerID:      pid,
			Value:         a.Value,
			Valid:         a.Valid,
			MergedInto:    a.MergedInto,
			PointsPreview: a.Points,
		})
	}
	sort.Slice(answers, func(i, j int) bool { return answers[i].PlayerID < answers[j].PlayerID })

	return game.ReviewStatePayload{
		RoundID:       r.ID,
		Letter:        r.Letter,
		CategoryID:    cat.ID,
		CategoryIndex: idx,
		CategoryCount: len(lobby.Categories),
		Answers:       answers,
	}
}

// buildRoundResult assembles per-player round points, totals and the ranking.
// Caller must hold hub.mu.
func buildRoundResult(lobby *game.Lobby, letter string, roundPoints map[string]int, isGameOver bool, reason string) game.RoundResultPayload {
	scores := make([]game.ScoreEntry, 0, len(lobby.Players))
	for pid, pl := range lobby.Players {
		scores = append(scores, game.ScoreEntry{
			PlayerID:    pid,
			RoundPoints: roundPoints[pid],
			TotalPoints: pl.Score,
		})
	}
	sort.Slice(scores, func(i, j int) bool { return scores[i].PlayerID < scores[j].PlayerID })
	// Carry the letter progress so the client's round-result screen is
	// self-sufficient (also after a reconnect, where no gameState is replayed).
	var used, remaining []string
	if lobby.Game != nil {
		used = lobby.Game.UsedLetters
		remaining = lobby.Game.RemainingLetters
	}
	return game.RoundResultPayload{
		Letter:           letter,
		Scores:           scores,
		Ranking:          game.ComputeRanking(lobby.Players),
		UsedLetters:      used,
		RemainingLetters: remaining,
		IsGameOver:       isGameOver,
		Reason:           reason,
	}
}

// ---- broadcasts ----

func (hub *Hub) broadcastTo(lobby *game.Lobby, msgType string, payload any) {
	hub.mu.Lock()
	lobby.Version++
	msg, _ := json.Marshal(OutboundMessage{Type: msgType, Payload: payload, StateVersion: lobby.Version})
	var targets []*Client
	for _, p := range lobby.Players {
		if cl, ok := hub.clients[p.SessionID]; ok {
			targets = append(targets, cl)
		}
	}
	hub.mu.Unlock()
	for _, cl := range targets {
		_ = cl.writeRaw(msg)
	}
}

func (hub *Hub) broadcastGameState(lobby *game.Lobby) {
	hub.mu.Lock()
	if lobby.Game == nil || lobby.Game.Round == nil {
		hub.mu.Unlock()
		return
	}
	payload := buildGameState(lobby)
	hub.mu.Unlock()
	hub.broadcastTo(lobby, "gameState", payload)
}

func (hub *Hub) broadcastReviewState(lobby *game.Lobby) {
	hub.mu.Lock()
	if lobby.Game == nil || lobby.Game.Round == nil || len(lobby.Categories) == 0 {
		hub.mu.Unlock()
		return
	}
	payload := buildReviewState(lobby)
	hub.mu.Unlock()
	hub.broadcastTo(lobby, "reviewState", payload)
}

func (hub *Hub) sendBuzzRejected(c *Client, reason string) {
	c.send("buzzRejected", map[string]string{"reason": reason})
}
