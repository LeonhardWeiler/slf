package websocket

import (
	"encoding/json"
	"log/slog"
	"time"

	"slf/internal/game"
)

const countdownSeconds = 3

// ---- Phase 1: start & countdown ----

func handleStartGame(hub *Hub, c *Client) {
	hub.mu.Lock()
	_, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok || !player.IsHost {
		hub.mu.Unlock()
		hub.sendError(c, CodeNotHost, "Nur der Host darf das Spiel starten")
		return
	}
	if lobby.State != game.StateLobby && lobby.State != game.StateGameOver {
		hub.mu.Unlock()
		hub.sendError(c, CodeGameAlreadyRunning, "Spiel läuft bereits")
		return
	}
	if len(lobby.Players) < 1 || len(lobby.Categories) < 1 {
		hub.mu.Unlock()
		hub.sendError(c, CodeValidationError, "Mindestens 1 Spieler und 1 Kategorie nötig")
		return
	}
	letters := game.AlphabetExcluding(lobby.Settings.ExcludedLetters)
	if len(letters) < 1 {
		hub.mu.Unlock()
		hub.sendError(c, CodeValidationError, "Mindestens ein Buchstabe muss aktiv sein")
		return
	}
	for _, p := range lobby.Players {
		p.Score = 0
	}
	lobby.Game = &game.Game{
		RemainingLetters: letters,
		UsedLetters:      []string{},
	}
	slog.Info("game started",
		"lobby", lobby.Code, "players", len(lobby.Players), "letters", len(letters))
	hub.mu.Unlock()

	hub.beginCountdown(lobby)
}

// beginCountdown starts a new round in the Countdown state and schedules the
// transition into Playing.
func (hub *Hub) beginCountdown(lobby *game.Lobby) {
	hub.mu.Lock()
	g := lobby.Game
	if g == nil {
		hub.mu.Unlock()
		return
	}
	letter, remaining := game.PickRandomLetter(g.RemainingLetters)
	if letter == "" {
		hub.mu.Unlock()
		hub.endGame(lobby, "AlphabetFinished")
		return
	}
	g.RemainingLetters = remaining
	g.UsedLetters = append(g.UsedLetters, letter)
	round := &game.Round{
		ID:        generateID(),
		Letter:    letter,
		Answers:   map[string]map[string]*game.Answer{},
		StartedAt: time.Now(),
	}
	g.Round = round
	setLobbyState(lobby, game.StateCountdown)
	roundID := round.ID
	hub.mu.Unlock()

	hub.broadcastLobbyState(lobby)
	hub.broadcastGameState(lobby)

	time.AfterFunc(countdownSeconds*time.Second, func() {
		hub.beginPlaying(lobby, roundID)
	})
}

func (hub *Hub) beginPlaying(lobby *game.Lobby, roundID string) {
	hub.mu.Lock()
	g := lobby.Game
	if g == nil || g.Round == nil || g.Round.ID != roundID || lobby.State != game.StateCountdown {
		hub.mu.Unlock()
		return
	}
	setLobbyState(lobby, game.StatePlaying)
	g.Round.StartedAt = time.Now()
	var endsAt time.Time
	if lobby.Settings.TimeLimit != nil {
		endsAt = time.Now().Add(time.Duration(*lobby.Settings.TimeLimit) * time.Second)
		g.Round.EndsAt = endsAt
	}
	hub.mu.Unlock()

	hub.broadcastLobbyState(lobby)
	hub.broadcastGameState(lobby)

	if !endsAt.IsZero() {
		time.AfterFunc(time.Until(endsAt), func() {
			hub.endRound(lobby, roundID)
		})
	}
}

// ---- Phase 2: playing ----

func handleAnswerUpdate(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		CategoryID string `json:"categoryId"`
		Value      string `json:"value"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return
	}
	hub.mu.Lock()
	defer hub.mu.Unlock()
	session, lobby, _, ok := hub.lookupLocked(c.sessionID)
	if !ok || lobby.State != game.StatePlaying || lobby.Game == nil || lobby.Game.Round == nil {
		return
	}
	if !categoryExists(lobby, p.CategoryID) {
		return
	}
	storeAnswer(lobby.Game.Round, session.PlayerID, p.CategoryID, p.Value)
}

func handleInputSync(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		RoundID string `json:"roundId"`
		Answers []struct {
			CategoryID string `json:"categoryId"`
			Value      string `json:"value"`
		} `json:"answers"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return
	}
	hub.mu.Lock()
	defer hub.mu.Unlock()
	session, lobby, _, ok := hub.lookupLocked(c.sessionID)
	if !ok || lobby.State != game.StatePlaying || lobby.Game == nil || lobby.Game.Round == nil {
		return
	}
	if lobby.Game.Round.ID != p.RoundID {
		return
	}
	for _, a := range p.Answers {
		if categoryExists(lobby, a.CategoryID) {
			storeAnswer(lobby.Game.Round, session.PlayerID, a.CategoryID, a.Value)
		}
	}
}

func handleBuzz(hub *Hub, c *Client) {
	hub.mu.Lock()
	session, lobby, _, ok := hub.lookupLocked(c.sessionID)
	if !ok || lobby.State != game.StatePlaying || lobby.Game == nil || lobby.Game.Round == nil {
		hub.mu.Unlock()
		hub.sendBuzzRejected(c, "invalidState")
		return
	}
	round := lobby.Game.Round
	// Every category must have an answer (SRS 5.7) and — server-authoritative,
	// not just the client's Zod gate — each answer must satisfy the formal rules
	// for the round letter: 1–30 chars, starting with the letter (SRS 9.13.15).
	answers := round.Answers[session.PlayerID]
	for _, cat := range lobby.Categories {
		ans := answers[cat.ID]
		if answers == nil || ans == nil || game.Normalize(ans.Value) == "" {
			hub.mu.Unlock()
			hub.sendBuzzRejected(c, "incompleteAnswers")
			return
		}
		if !game.IsRuleValid(round.Letter, ans.Value) {
			hub.mu.Unlock()
			hub.sendBuzzRejected(c, "invalidAnswers")
			return
		}
	}
	roundID := round.ID
	hub.mu.Unlock()

	hub.endRound(lobby, roundID)
}

// ---- Phase 3: review ----

// endRound finalizes the playing phase and moves into review. Idempotent via
// the roundID + state guard, so a late timer after a buzz is a no-op.
func (hub *Hub) endRound(lobby *game.Lobby, roundID string) {
	hub.mu.Lock()
	g := lobby.Game
	if g == nil || g.Round == nil || g.Round.ID != roundID || lobby.State != game.StatePlaying {
		hub.mu.Unlock()
		return
	}
	setLobbyState(lobby, game.StateReviewing)
	g.Round.ReviewIndex = 0
	// Default validity: rule-conforming answers start valid (SRS 6.4).
	for _, byCat := range g.Round.Answers {
		for _, ans := range byCat {
			ans.Valid = game.IsRuleValid(g.Round.Letter, ans.Value)
		}
	}
	hub.mu.Unlock()

	hub.broadcastLobbyState(lobby)
	hub.broadcastReviewState(lobby)
}

// mutateReview runs fn under lock if the caller is the host during review.
// fn receives the lobby and the id of the category currently under review and
// returns whether a change was made. Returns the lobby (for broadcasting) or nil.
func (hub *Hub) mutateReview(c *Client, fn func(lobby *game.Lobby, curCatID string) bool) *game.Lobby {
	hub.mu.Lock()
	_, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok || !player.IsHost || lobby.State != game.StateReviewing ||
		lobby.Game == nil || lobby.Game.Round == nil {
		hub.mu.Unlock()
		return nil
	}
	curCat := ""
	if idx := lobby.Game.Round.ReviewIndex; idx >= 0 && idx < len(lobby.Categories) {
		curCat = lobby.Categories[idx].ID
	}
	changed := fn(lobby, curCat)
	hub.mu.Unlock()
	if !changed {
		return nil
	}
	return lobby
}

func handleSetAnswerValidity(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		AnswerID string `json:"answerId"`
		Valid    bool   `json:"valid"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return
	}
	if lobby := hub.mutateReview(c, func(lobby *game.Lobby, catID string) bool {
		if ans := answerFor(lobby.Game.Round, p.AnswerID, catID); ans != nil {
			ans.Valid = p.Valid
			return true
		}
		return false
	}); lobby != nil {
		hub.broadcastReviewState(lobby)
	}
}

func handleMergeAnswers(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		TargetAnswerID string `json:"targetAnswerId"`
		SourceAnswerID string `json:"sourceAnswerId"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return
	}
	if p.TargetAnswerID == p.SourceAnswerID {
		return
	}
	if lobby := hub.mutateReview(c, func(lobby *game.Lobby, catID string) bool {
		src := answerFor(lobby.Game.Round, p.SourceAnswerID, catID)
		tgt := answerFor(lobby.Game.Round, p.TargetAnswerID, catID)
		if src == nil || tgt == nil {
			return false
		}
		src.MergedInto = p.TargetAnswerID
		return true
	}); lobby != nil {
		hub.broadcastReviewState(lobby)
	}
}

func handleUnmergeAnswers(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		AnswerID string `json:"answerId"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return
	}
	if lobby := hub.mutateReview(c, func(lobby *game.Lobby, catID string) bool {
		if ans := answerFor(lobby.Game.Round, p.AnswerID, catID); ans != nil {
			ans.MergedInto = ""
			return true
		}
		return false
	}); lobby != nil {
		hub.broadcastReviewState(lobby)
	}
}

func handleNextCategory(hub *Hub, c *Client) {
	if lobby := hub.mutateReview(c, func(lobby *game.Lobby, _ string) bool {
		r := lobby.Game.Round
		if r.ReviewIndex < len(lobby.Categories)-1 {
			r.ReviewIndex++
			return true
		}
		return false
	}); lobby != nil {
		hub.broadcastReviewState(lobby)
	}
}

func handlePreviousCategory(hub *Hub, c *Client) {
	if lobby := hub.mutateReview(c, func(lobby *game.Lobby, _ string) bool {
		r := lobby.Game.Round
		if r.ReviewIndex > 0 {
			r.ReviewIndex--
			return true
		}
		return false
	}); lobby != nil {
		hub.broadcastReviewState(lobby)
	}
}

// ---- Phase 4: scoring & result ----

func handleFinishReview(hub *Hub, c *Client) {
	hub.mu.Lock()
	_, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok || !player.IsHost || lobby.State != game.StateReviewing {
		hub.mu.Unlock()
		hub.sendError(c, CodeInvalidState, "Aktion nicht erlaubt")
		return
	}
	round := lobby.Game.Round
	roundPoints := map[string]int{}
	for _, cat := range lobby.Categories {
		perCat := map[string]*game.Answer{}
		for pid, byCat := range round.Answers {
			if ans, ok := byCat[cat.ID]; ok {
				perCat[pid] = ans
			}
		}
		game.ScoreCategory(perCat)
		for pid, ans := range perCat {
			roundPoints[pid] += ans.Points
		}
	}
	for pid, pts := range roundPoints {
		if pl, ok := lobby.Players[pid]; ok {
			pl.Score += pts
		}
	}
	setLobbyState(lobby, game.StateRoundResult)
	result := buildRoundResult(lobby, round.Letter, roundPoints, false, "")
	lobby.Game.LastResult = &result
	hub.mu.Unlock()

	hub.broadcastLobbyState(lobby)
	hub.broadcastTo(lobby, "roundResult", result)
}

func handleStartNextRound(hub *Hub, c *Client) {
	hub.mu.Lock()
	_, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok || !player.IsHost || lobby.State != game.StateRoundResult {
		hub.mu.Unlock()
		hub.sendError(c, CodeInvalidState, "Aktion nicht erlaubt")
		return
	}
	noLetters := lobby.Game == nil || len(lobby.Game.RemainingLetters) == 0
	hub.mu.Unlock()

	if noLetters {
		hub.endGame(lobby, "AlphabetFinished")
		return
	}
	hub.beginCountdown(lobby)
}

func handleEndGame(hub *Hub, c *Client) {
	hub.mu.Lock()
	_, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok || !player.IsHost {
		hub.mu.Unlock()
		hub.sendError(c, CodeNotHost, "Nur der Host darf das Spiel beenden")
		return
	}
	if lobby.State == game.StateLobby || lobby.State == game.StateGameOver {
		hub.mu.Unlock()
		return
	}
	hub.mu.Unlock()
	hub.endGame(lobby, "HostEnded")
}

// handleReturnToLobby brings a finished game back to the Lobby state so the
// host can reconfigure and start fresh. Only valid from RoundResult / GameOver.
func handleReturnToLobby(hub *Hub, c *Client) {
	hub.mu.Lock()
	_, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok || !player.IsHost {
		hub.mu.Unlock()
		hub.sendError(c, CodeNotHost, "Nur der Host darf zur Lobby zurückkehren")
		return
	}
	if lobby.State != game.StateRoundResult && lobby.State != game.StateGameOver {
		hub.mu.Unlock()
		hub.sendError(c, CodeInvalidState, "Aktion nicht erlaubt")
		return
	}
	setLobbyState(lobby, game.StateLobby)
	lobby.Game = nil
	// Drop players who left mid-game (they only stayed for the final table) and
	// reset every remaining score for the next game.
	for id, p := range lobby.Players {
		if p.Left {
			delete(lobby.Players, id)
			delete(hub.sessions, p.SessionID)
			delete(hub.clients, p.SessionID)
			continue
		}
		p.Score = 0
	}
	hub.mu.Unlock()

	hub.broadcastLobbyState(lobby)
}

func (hub *Hub) endGame(lobby *game.Lobby, reason string) {
	hub.mu.Lock()
	setLobbyState(lobby, game.StateGameOver)
	result := buildRoundResult(lobby, "", map[string]int{}, true, reason)
	if lobby.Game != nil {
		lobby.Game.LastResult = &result
	}
	hub.mu.Unlock()

	hub.broadcastLobbyState(lobby)
	hub.broadcastTo(lobby, "roundResult", result)
}

// sendCurrentGameStateTo replays the active phase to a single (reconnecting)
// client so it lands on the correct screen (SRS 8.3).
func (hub *Hub) sendCurrentGameStateTo(c *Client, lobby *game.Lobby) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	switch lobby.State {
	case game.StateCountdown, game.StatePlaying:
		if lobby.Game != nil && lobby.Game.Round != nil {
			c.sendV("gameState", buildGameState(lobby), lobby.Version)
		}
	case game.StateReviewing:
		if lobby.Game != nil && lobby.Game.Round != nil && len(lobby.Categories) > 0 {
			c.sendV("reviewState", buildReviewState(lobby), lobby.Version)
		}
	case game.StateRoundResult, game.StateGameOver:
		if lobby.Game != nil && lobby.Game.LastResult != nil {
			c.sendV("roundResult", *lobby.Game.LastResult, lobby.Version)
		}
	}
}
