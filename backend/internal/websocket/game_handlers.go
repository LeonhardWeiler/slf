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
	// A commentator host does not play, so at least one other player is needed.
	if !lobby.Settings.HostPlays {
		playing := 0
		for _, p := range lobby.Players {
			if !p.IsHost {
				playing++
			}
		}
		if playing < 1 {
			hub.mu.Unlock()
			hub.sendError(c, CodeValidationError, "Als Kommentator brauchst du mindestens einen Mitspieler")
			return
		}
	}
	letters := game.AlphabetExcluding(lobby.Settings.ExcludedLetters)
	if len(letters) < 1 {
		hub.mu.Unlock()
		hub.sendError(c, CodeValidationError, "Mindestens ein Buchstabe muss aktiv sein")
		return
	}
	hub.resetForNewGame(lobby)
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
	// Don't start a new round on an empty lobby (everyone left or disconnected):
	// there would be no one to answer and the round would be a dead end. Fall back
	// to the Lobby state so the lobby stays usable and players who (re)join later
	// can start fresh.
	if !hasRoundParticipant(lobby) {
		lobby.Game = nil
		setLobbyState(lobby, game.StateLobby)
		hub.mu.Unlock()
		hub.broadcastLobbyState(lobby)
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
	// A new round begins -> any mid-game joiners who were waiting as spectators
	// become full participants now and score from this round on.
	for _, p := range lobby.Players {
		p.Pending = false
	}
	round := &game.Round{
		ID:        generateID(),
		Letter:    letter,
		Answers:   map[string]map[string]*game.Answer{},
		Flames:    map[string]string{},
		StartedAt: time.Now(),
	}
	g.Round = round
	setLobbyState(lobby, game.StateCountdown)
	roundID := round.ID
	hub.mu.Unlock()

	hub.broadcastLobbyState(lobby)
	hub.broadcastGameState(lobby)

	// If the lobby is closed/reset before this fires, beginPlaying is a guarded
	// no-op (nil Game, mismatched roundID or wrong state), so a lingering timer on
	// an abandoned lobby does no harm and needs no explicit cancellation.
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
	// A commentator host sees the (initially empty) fill overview right away.
	hub.notifyCommentator(lobby)

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
	session, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok || lobby.State != game.StatePlaying || lobby.Game == nil || lobby.Game.Round == nil {
		hub.mu.Unlock()
		return
	}
	// A round spectator (commentator host or pending mid-game joiner) does not
	// play, so it must not submit answers (they would otherwise show up in review
	// and skew the category scoring for everyone else).
	if isRoundSpectator(lobby, player) {
		hub.mu.Unlock()
		return
	}
	if !categoryExists(lobby, p.CategoryID) {
		hub.mu.Unlock()
		return
	}
	storeAnswer(lobby.Game.Round, session.PlayerID, p.CategoryID, p.Value)
	hub.mu.Unlock()

	// Keep a commentator host's fill overview live as players type.
	hub.notifyCommentator(lobby)
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
	session, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok || lobby.State != game.StatePlaying || lobby.Game == nil || lobby.Game.Round == nil {
		hub.mu.Unlock()
		return
	}
	if isRoundSpectator(lobby, player) {
		hub.mu.Unlock()
		return
	}
	if lobby.Game.Round.ID != p.RoundID {
		hub.mu.Unlock()
		return
	}
	for _, a := range p.Answers {
		if categoryExists(lobby, a.CategoryID) {
			storeAnswer(lobby.Game.Round, session.PlayerID, a.CategoryID, a.Value)
		}
	}
	hub.mu.Unlock()

	hub.notifyCommentator(lobby)
}

// handleSetFlame records (or clears, when categoryId is empty) the player's
// flame for this round - a bet that their answer for that category is unique.
// At most one flame per player per round, only while playing and only when the
// host enabled the feature.
func handleSetFlame(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		CategoryID string `json:"categoryId"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return
	}
	hub.mu.Lock()
	defer hub.mu.Unlock()
	session, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok || !lobby.Settings.FlamesEnabled ||
		lobby.State != game.StatePlaying || lobby.Game == nil || lobby.Game.Round == nil {
		return
	}
	// A round spectator (commentator host or pending joiner) does not play, so
	// cannot flame.
	if isRoundSpectator(lobby, player) {
		return
	}
	if p.CategoryID == "" {
		delete(lobby.Game.Round.Flames, session.PlayerID)
		return
	}
	if !categoryExists(lobby, p.CategoryID) {
		return
	}
	lobby.Game.Round.Flames[session.PlayerID] = p.CategoryID
}

func handleBuzz(hub *Hub, c *Client) {
	hub.mu.Lock()
	session, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok || lobby.State != game.StatePlaying || lobby.Game == nil || lobby.Game.Round == nil {
		hub.mu.Unlock()
		hub.sendBuzzRejected(c, "invalidState")
		return
	}
	// A round spectator (commentator host or pending joiner) does not play and
	// therefore cannot buzz.
	if isRoundSpectator(lobby, player) {
		hub.mu.Unlock()
		hub.sendBuzzRejected(c, "invalidState")
		return
	}
	round := lobby.Game.Round
	// Every category must have an answer (SRS 5.7) and - server-authoritative,
	// not just the client's Zod gate - each answer must satisfy the formal rules
	// for the round letter: 1-30 chars, starting with the letter (SRS 9.13.15).
	answers := round.Answers[session.PlayerID]
	for _, cat := range lobby.Categories {
		ans := answers[cat.ID]
		if answers == nil || ans == nil || game.Normalize(ans.Value) == "" {
			hub.mu.Unlock()
			hub.sendBuzzRejected(c, "incompleteAnswers")
			return
		}
		if !game.IsRuleValid(round.Letter, ans.Value, lobby.Settings.LastLetterMode) {
			hub.mu.Unlock()
			hub.sendBuzzRejected(c, "invalidAnswers")
			return
		}
	}
	round.BuzzedBy = session.PlayerID
	roundID := round.ID
	hub.mu.Unlock()

	hub.endRound(lobby, roundID)
}

// handleEndRound lets the host stop the running round early and move everyone to
// review - the counterpart to a player's buzz for when nobody can (or wants to)
// buzz, e.g. a hard letter or a commentator host who never plays. Only the host,
// only while playing.
func handleEndRound(hub *Hub, c *Client) {
	hub.mu.Lock()
	_, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok || !player.IsHost || lobby.State != game.StatePlaying ||
		lobby.Game == nil || lobby.Game.Round == nil {
		hub.mu.Unlock()
		return
	}
	roundID := lobby.Game.Round.ID
	hub.mu.Unlock()

	hub.endRound(lobby, roundID)
}

// ---- Phase 3: review ----

// endRound finalizes the playing phase. When at least one active player submitted
// something it moves into review; when no active (non-left, non-spectator) player
// submitted anything there is nothing to review, so it scores straight away and
// jumps to the scoreboard. Idempotent via the roundID + state guard, so a late
// timer after a buzz is a no-op.
func (hub *Hub) endRound(lobby *game.Lobby, roundID string) {
	hub.mu.Lock()
	g := lobby.Game
	if g == nil || g.Round == nil || g.Round.ID != roundID || lobby.State != game.StatePlaying {
		hub.mu.Unlock()
		return
	}
	// Default validity: rule-conforming answers start valid (SRS 6.4). Done before
	// the empty-round check so scoring is correct on the direct-to-scoreboard path.
	for _, byCat := range g.Round.Answers {
		for _, ans := range byCat {
			ans.Valid = game.IsRuleValid(g.Round.Letter, ans.Value, lobby.Settings.LastLetterMode)
		}
	}
	// No active player submitted an answer (players who already left are ignored):
	// skip the review screen entirely and go directly to the scoreboard.
	if !hasActiveSubmission(lobby) {
		result := hub.scoreAndFinishRound(lobby)
		hub.mu.Unlock()
		hub.broadcastLobbyState(lobby)
		hub.broadcastTo(lobby, "roundResult", result)
		return
	}
	setLobbyState(lobby, game.StateReviewing)
	g.Round.ReviewIndex = 0
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
	if lobby.Game == nil || lobby.Game.Round == nil {
		hub.mu.Unlock()
		hub.sendError(c, CodeInvalidState, "Keine aktive Runde")
		return
	}
	result := hub.scoreAndFinishRound(lobby)
	hub.mu.Unlock()

	hub.broadcastLobbyState(lobby)
	hub.broadcastTo(lobby, "roundResult", result)
}

// scoreAndFinishRound scores the current round, applies the points to each
// player's total, transitions to RoundResult and returns the built result (also
// stored as LastResult for reconnects). Shared by the normal review-finish path
// and the empty-round shortcut in endRound. Caller must hold hub.mu.
func (hub *Hub) scoreAndFinishRound(lobby *game.Lobby) game.RoundResultPayload {
	round := lobby.Game.Round
	roundPoints := map[string]int{}
	for _, cat := range lobby.Categories {
		perCat := map[string]*game.Answer{}
		for pid, byCat := range round.Answers {
			// Defense-in-depth: never score a round spectator (commentator host or
			// pending joiner), even if a crafted client slipped answers into the round.
			if pl, ok := lobby.Players[pid]; ok && isRoundSpectator(lobby, pl) {
				continue
			}
			if ans, ok := byCat[cat.ID]; ok {
				perCat[pid] = ans
			}
		}
		game.ScoreCategory(perCat, flamedFor(round, cat.ID))
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
	return result
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

// resetForNewGame drops players who left a previous game (they lingered only
// for the final standings) and zeroes every remaining player's score.
// Caller must hold hub.mu.
func (hub *Hub) resetForNewGame(lobby *game.Lobby) {
	for id, p := range lobby.Players {
		if p.Left {
			delete(lobby.Players, id)
			delete(hub.sessions, p.SessionID)
			delete(hub.clients, p.SessionID)
			continue
		}
		p.Score = 0
		// A fresh game/lobby has no waiting spectators: any mid-game joiner who is
		// still pending becomes a normal member.
		p.Pending = false
	}
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
	hub.resetForNewGame(lobby)
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
			// A reconnecting/joining spectator (commentator host or pending
			// mid-game joiner) also gets the current fill overview so its board
			// is populated right away.
			if me := hub.playerForLocked(c); me != nil && isRoundSpectator(lobby, me) {
				c.sendV("commentatorState", buildCommentatorState(lobby), lobby.Version)
			}
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
