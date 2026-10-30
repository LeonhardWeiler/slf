package websocket

import (
	"encoding/json"
	"log/slog"
	"slices"
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
	if !idle(lobby) {
		hub.mu.Unlock()
		hub.sendError(c, CodeGameAlreadyRunning, "Spiel läuft bereits")
		return
	}
	if hub.draining {
		hub.mu.Unlock()
		hub.sendError(c, CodeInvalidState, "Gleich kommt ein Update. Bitte in ein paar Minuten nochmal starten.")
		return
	}
	if len(lobby.Categories) < 1 {
		hub.mu.Unlock()
		hub.sendError(c, CodeValidationError, "Mindestens 1 Kategorie nötig")
		return
	}
	// Guard with the same predicate beginCountdown uses, so the two can't
	// disagree: counting players who are merely present (but disconnected, or the
	// commentator host) let the start succeed here and then fall back to Lobby
	// there - the host clicked and nothing happened, with no explanation.
	if !hasRoundParticipant(lobby) {
		msg := "Mindestens ein verbundener Spieler nötig"
		if !lobby.Settings.HostPlays {
			msg = "Als Kommentator brauchst du mindestens einen verbundenen Mitspieler"
		}
		hub.mu.Unlock()
		hub.sendError(c, CodeValidationError, msg)
		return
	}
	letters := game.AlphabetExcluding(lobby.Settings.ExcludedLetters)
	if len(letters) < 1 {
		hub.mu.Unlock()
		hub.sendError(c, CodeValidationError, "Mindestens ein Buchstabe muss aktiv sein")
		return
	}
	from := lobby.State
	hub.resetForNewGame(lobby)
	lobby.Game = &game.Game{
		RemainingLetters: letters,
		UsedLetters:      []string{},
		Mode:             "classic",
		StartedAt:        time.Now(),
	}
	if soloPlayer(lobby) != nil {
		lobby.Game.Mode = "solo"
	}
	hub.Stats.Add(gameEvent("start", lobby))
	slog.Info("game started",
		"lobby", lobby.Code, "players", len(lobby.Players), "letters", len(letters))
	hub.mu.Unlock()

	hub.beginCountdown(lobby, from)
}

// beginCountdown starts a new round in the Countdown state and schedules the
// transition into Playing. The caller checked its precondition under an earlier
// lock; from is the state it saw, re-checked here so 2 concurrent starts (2
// sockets on one session) cannot both begin a round.
func (hub *Hub) beginCountdown(lobby *game.Lobby, from game.GameState) {
	hub.mu.Lock()
	g := lobby.Game
	if g == nil || lobby.State != from {
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
	letter := game.PickRandomLetter(g.RemainingLetters)
	if letter == "" {
		hub.mu.Unlock()
		hub.endGame(lobby, "AlphabetFinished")
		return
	}
	// A new round begins -> any mid-game joiners who were waiting as spectators
	// become full participants now and score from this round on.
	for _, p := range lobby.Players {
		p.Pending = false
	}
	round := &game.Round{
		ID:        generateID(),
		Letter:    letter,
		Answers:   map[string]map[string]*game.Answer{},
		Pos:       map[string]int{},
		StartedAt: time.Now(),
	}
	if soloPlayer(lobby) != nil {
		round.Letters = sprintLetters(g.RemainingLetters, len(lobby.Categories), lobby.Settings.TimeLimit)
		round.Letter = round.Letters[0]
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
	g.RemainingLetters = slices.DeleteFunc(slices.Clone(g.RemainingLetters), func(l string) bool { return l == g.Round.Letter })
	g.UsedLetters = append(g.UsedLetters, g.Round.Letter)
	if g.Round.Letters != nil {
		g.RemainingLetters = []string{}
	}
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
			hub.endRound(lobby, roundID, "timeout", "")
		})
	}
}

// ---- Phase 2: playing ----

func handleAnswerUpdate(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		RoundID    string `json:"roundId"`
		CategoryID string `json:"categoryId"`
		Value      string `json:"value"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return
	}
	hub.mu.Lock()
	session, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok || !inRound(lobby, p.RoundID) || lobby.Game.Round.Letters != nil {
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
	before := commentatorRow(lobby, player)
	storeAnswer(lobby.Game.Round, session.PlayerID, p.CategoryID, p.Value)
	hub.notifyRowLocked(lobby, player, before)
	hub.mu.Unlock()
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
	if !ok || !inRound(lobby, p.RoundID) || isRoundSpectator(lobby, player) || lobby.Game.Round.Letters != nil {
		hub.mu.Unlock()
		return
	}
	before := commentatorRow(lobby, player)
	for _, a := range p.Answers {
		if categoryExists(lobby, a.CategoryID) {
			storeAnswer(lobby.Game.Round, session.PlayerID, a.CategoryID, a.Value)
		}
	}
	hub.notifyRowLocked(lobby, player, before)
	hub.mu.Unlock()
}

// handleSprintWord takes the player's word for sprint prompt pos; an empty
// value skips the prompt. Prompts only move forward.
func handleSprintWord(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		RoundID string `json:"roundId"`
		Pos     int    `json:"pos"`
		Value   string `json:"value"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return
	}
	hub.mu.Lock()
	defer hub.mu.Unlock()
	_, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok || !inRound(lobby, p.RoundID) || isRoundSpectator(lobby, player) {
		return
	}
	r, n := lobby.Game.Round, len(lobby.Categories)
	if r.Letters == nil || p.Pos < r.Pos[player.ID] || p.Pos >= len(r.Letters)*n {
		return
	}
	letter := r.Letters[p.Pos/n]
	if p.Value != "" && !game.IsRuleValid(letter, p.Value, lobby.Settings.LastLetterMode) {
		return
	}
	r.Pos[player.ID] = p.Pos + 1
	if p.Value != "" {
		storeAnswer(r, player.ID, sprintKey(p.Pos/n, lobby.Categories[p.Pos%n].ID), p.Value)
	}
	if r.Pos[player.ID] == len(r.Letters)*n {
		go hub.endRound(lobby, r.ID, "timeout", "")
	}
}

func handleBuzz(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		RoundID string `json:"roundId"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return
	}
	hub.mu.Lock()
	session, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok || !inRound(lobby, p.RoundID) {
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
	// for the round letter: 2-30 chars, starting with the letter (SRS 9.13.15).
	// A solo player only ends their own round, so they may stop at any time.
	if soloPlayer(lobby) == nil {
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
	}
	buzzer := session.PlayerID
	roundID := round.ID
	hub.mu.Unlock()

	hub.endRound(lobby, roundID, "buzz", buzzer)
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

	hub.endRound(lobby, roundID, "host", "")
}

// ---- Phase 3: review ----

// answerGrace is how long a round keeps taking answers after it was ended, so
// keystrokes still in flight (client debounce + latency) are not lost.
const answerGrace = 500 * time.Millisecond

// buzzBonus goes to whoever buzzed the round.
const buzzBonus = 200

// endRound ends the playing phase after answerGrace. Idempotent via the
// roundID, state and EndReason guard, so a late timer after a buzz is a no-op.
func (hub *Hub) endRound(lobby *game.Lobby, roundID, reason, buzzer string) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	g := lobby.Game
	if g == nil || g.Round == nil || g.Round.ID != roundID || lobby.State != game.StatePlaying || g.Round.EndReason != "" {
		return
	}
	g.Round.EndReason = reason
	g.Round.BuzzedBy = buzzer
	time.AfterFunc(answerGrace, func() { hub.finishPlaying(lobby, roundID) })
}

// finishPlaying freezes the answers. When at least one active player submitted
// something it moves into review; when no active (non-left, non-spectator) player
// submitted anything there is nothing to review, so it scores straight away and
// jumps to the scoreboard. A solo round is scored straight away too: a sprint
// refuses rule-breaking words as they are typed.
func (hub *Hub) finishPlaying(lobby *game.Lobby, roundID string) {
	hub.mu.Lock()
	g := lobby.Game
	if g == nil || g.Round == nil || g.Round.ID != roundID || lobby.State != game.StatePlaying {
		hub.mu.Unlock()
		return
	}
	// Default validity: rule-conforming answers start valid (SRS 6.4). Done before
	// the empty-round check so scoring is correct on the direct-to-scoreboard path.
	g.Round.Slots = roundSlots(lobby)
	for _, s := range g.Round.Slots {
		for _, byCat := range g.Round.Answers {
			if ans := byCat[s.Key]; ans != nil {
				ans.Valid = game.IsRuleValid(s.Letter, ans.Value, lobby.Settings.LastLetterMode)
			}
		}
	}
	solo, empty := soloPlayer(lobby) != nil, !hasActiveSubmission(lobby)
	if solo || empty {
		result := hub.scoreAndFinishRound(lobby)
		result.Empty = empty
		g.LastResult = &result
		hub.mu.Unlock()
		if solo {
			hub.nextRound(lobby)
			return
		}
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

// mutateReview runs fn under lock if the caller is the host (or, unless
// hostOnly, a voter) during review. fn receives the lobby, the caller and the id
// of the category under review and returns whether a change was made. Returns
// the lobby (for broadcasting) or nil.
func (hub *Hub) mutateReview(c *Client, hostOnly bool, fn func(lobby *game.Lobby, p *game.Player, curCatID string) bool) *game.Lobby {
	hub.mu.Lock()
	_, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok || lobby.State != game.StateReviewing || lobby.Game == nil || lobby.Game.Round == nil ||
		!(player.IsHost || !hostOnly && votesThisRound(lobby, player)) {
		hub.mu.Unlock()
		return nil
	}
	r := lobby.Game.Round
	idx := r.ReviewIndex
	curCat := ""
	if idx >= 0 && idx < len(r.Slots) {
		curCat = r.Slots[idx].Key
	}
	changed := fn(lobby, player, curCat)
	hub.mu.Unlock()
	if !changed {
		return nil
	}
	return lobby
}

func handleVoteAnswer(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		AnswerID string `json:"answerId"`
		// Vote is 1 (up), -1 (down) or 0 (withdraw).
		Vote int `json:"vote"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return
	}
	if lobby := hub.mutateReview(c, false, func(lobby *game.Lobby, pl *game.Player, catID string) bool {
		ans := answerFor(lobby.Game.Round, p.AnswerID, catID)
		if ans == nil || p.AnswerID == pl.ID || !votesThisRound(lobby, pl) {
			return false
		}
		if p.Vote == 0 {
			delete(ans.Votes, pl.ID)
			return true
		}
		if ans.Votes == nil {
			ans.Votes = map[string]bool{}
		}
		ans.Votes[pl.ID] = p.Vote > 0
		return true
	}); lobby != nil {
		hub.broadcastReviewState(lobby)
	}
}

// reviewHold keeps the last ready tick on screen before the review moves on.
const reviewHold = 700 * time.Millisecond

// handleReviewReady toggles the caller's "done" mark for the category under
// review. Once every voter is done the review moves on by itself.
func handleReviewReady(hub *Hub, c *Client) {
	if lobby := hub.mutateReview(c, false, func(lobby *game.Lobby, pl *game.Player, _ string) bool {
		if !votesThisRound(lobby, pl) {
			return false
		}
		r := lobby.Game.Round
		if r.Ready == nil {
			r.Ready = map[string]bool{}
		}
		r.Ready[pl.ID] = !r.Ready[pl.ID]
		return true
	}); lobby != nil {
		hub.broadcastReviewState(lobby)
	}
}

// advanceReview moves on once all voters are still ready on the same category.
func (hub *Hub) advanceReview(lobby *game.Lobby, roundID string, idx int) {
	hub.mu.Lock()
	g := lobby.Game
	if lobby.State != game.StateReviewing || g == nil || g.Round == nil || g.Round.ID != roundID || g.Round.ReviewIndex != idx {
		hub.mu.Unlock()
		return
	}
	before := g.Round.ReviewIndex
	finish := advanceIfReady(lobby)
	moved := g.Round.ReviewIndex != before
	hub.mu.Unlock()
	if finish {
		hub.finishReview(lobby)
	} else if moved {
		hub.broadcastReviewState(lobby)
	}
}

// advanceIfReady moves to the next category once all voters are done and
// reports whether the last category was done. Caller must hold hub.mu.
func advanceIfReady(lobby *game.Lobby) bool {
	r := lobby.Game.Round
	voters := 0
	for _, p := range lobby.Players {
		if votesThisRound(lobby, p) {
			if !r.Ready[p.ID] {
				return false
			}
			voters++
		}
	}
	if voters == 0 {
		return false
	}
	if r.ReviewIndex >= len(r.Slots)-1 {
		return true
	}
	r.ReviewIndex++
	r.Ready = nil
	return false
}

func handleSetAnswerValidity(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		AnswerID string `json:"answerId"`
		Valid    bool   `json:"valid"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return
	}
	if lobby := hub.mutateReview(c, true, func(lobby *game.Lobby, _ *game.Player, catID string) bool {
		if ans := answerFor(lobby.Game.Round, p.AnswerID, catID); ans != nil {
			ans.Valid, ans.Ruled = p.Valid, true
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
	if lobby := hub.mutateReview(c, true, func(lobby *game.Lobby, _ *game.Player, catID string) bool {
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
	if lobby := hub.mutateReview(c, true, func(lobby *game.Lobby, _ *game.Player, catID string) bool {
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
	if lobby := hub.mutateReview(c, true, func(lobby *game.Lobby, _ *game.Player, _ string) bool {
		r := lobby.Game.Round
		if r.ReviewIndex < len(r.Slots)-1 {
			r.ReviewIndex++
			r.Ready = nil
			return true
		}
		return false
	}); lobby != nil {
		hub.broadcastReviewState(lobby)
	}
}

func handlePreviousCategory(hub *Hub, c *Client) {
	if lobby := hub.mutateReview(c, true, func(lobby *game.Lobby, _ *game.Player, _ string) bool {
		r := lobby.Game.Round
		if r.ReviewIndex > 0 {
			r.ReviewIndex--
			r.Ready = nil
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
	hub.mu.Unlock()
	hub.finishReview(lobby)
}

// finishReview scores the round and shows the result. Idempotent: only the
// first call scores.
func (hub *Hub) finishReview(lobby *game.Lobby) {
	hub.mu.Lock()
	if lobby.State != game.StateReviewing || lobby.Game == nil || lobby.Game.Round == nil {
		hub.mu.Unlock()
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
	points := map[string][]int{}
	for _, s := range round.Slots {
		for pid, ans := range scoredCategory(lobby, s.Key) {
			if ans.Points > 0 {
				points[pid] = append(points[pid], ans.Points)
			}
		}
	}
	entries := map[string]game.ScoreEntry{}
	for pid, pl := range lobby.Players {
		if !playsThisRound(lobby, pl) {
			continue
		}
		if len(points[pid]) == len(round.Slots) {
			pl.Combo++
		} else {
			pl.Combo = 0
		}
		e := game.ScoreEntry{Points: points[pid]}
		if round.BuzzedBy == pid {
			e.Buzz = buzzBonus
		}
		sum := e.Buzz
		for _, p := range e.Points {
			sum += p
		}
		e.Combo = sum * max(0, min(50, 10*(pl.Combo-1))) / 100
		e.RoundPoints = sum + e.Combo
		pl.Score += e.RoundPoints
		entries[pid] = e
	}
	setLobbyState(lobby, game.StateRoundResult)
	result := buildRoundResult(lobby, round.Letter, entries, false, "")
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
	hub.mu.Unlock()
	hub.nextRound(lobby)
}

// nextRound starts the next round, or ends the game once every letter is used.
func (hub *Hub) nextRound(lobby *game.Lobby) {
	hub.mu.Lock()
	noLetters := lobby.Game == nil || len(lobby.Game.RemainingLetters) == 0
	hub.mu.Unlock()

	if noLetters {
		hub.endGame(lobby, "AlphabetFinished")
		return
	}
	hub.beginCountdown(lobby, game.StateRoundResult)
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
	// The round under review is already played, so it counts.
	if lobby.State == game.StateReviewing && lobby.Game != nil && lobby.Game.Round != nil {
		hub.scoreAndFinishRound(lobby)
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
		p.Combo = 0
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
	result := buildRoundResult(lobby, "", nil, true, reason)
	if lobby.Game != nil {
		lobby.Game.LastResult = &result
		e := gameEvent("end", lobby)
		e.Reason = reason
		hub.Stats.Add(e)
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
			gs := buildGameState(lobby)
			if me := hub.playerForLocked(c); me != nil && gs.Letters != nil {
				gs.SprintPos, gs.SprintWords = sprintProgress(lobby, me.ID)
			}
			c.sendV("gameState", gs, lobby.Version)
			// A reconnecting/joining spectator (commentator host or pending
			// mid-game joiner) also gets the current fill overview so its board
			// is populated right away.
			if me := hub.playerForLocked(c); me != nil && isRoundSpectator(lobby, me) {
				c.sendV("commentatorState", buildCommentatorState(lobby), lobby.Version)
			}
		}
	case game.StateReviewing:
		if lobby.Game != nil && lobby.Game.Round != nil && len(lobby.Game.Round.Slots) > 0 {
			c.sendV("reviewState", buildReviewState(lobby), lobby.Version)
		}
	case game.StateRoundResult, game.StateGameOver:
		if lobby.Game != nil && lobby.Game.LastResult != nil {
			c.sendV("roundResult", *lobby.Game.LastResult, lobby.Version)
		}
	}
}
