package websocket

import (
	"cmp"
	"encoding/json"
	"log/slog"
	"math/rand/v2"
	"slices"
	"strconv"
	"strings"
	"time"

	"slf/internal/game"
)

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
	round.Answers[playerID][catID] = &game.Answer{Value: strings.TrimSpace(value)}
}

func answerFor(round *game.Round, playerID, catID string) *game.Answer {
	if byCat, ok := round.Answers[playerID]; ok {
		return byCat[catID]
	}
	return nil
}

// sprintKey keys a sprint answer by its index in Round.Letters, since a timed
// sprint repeats letters.
func sprintKey(i int, catID string) string {
	return strconv.Itoa(i) + ":" + catID
}

// sprintLetters shuffles the letters once without a time limit. With one it
// repeats shuffled cycles so the prompts outlast the clock at four a second.
func sprintLetters(letters []string, n int, limit *int) []string {
	cycles := 1
	if limit != nil {
		cycles = *limit*4/(len(letters)*max(1, n)) + 1
	}
	var out []string
	for range cycles {
		c := slices.Clone(letters)
		rand.Shuffle(len(c), func(i, j int) { c[i], c[j] = c[j], c[i] })
		out = append(out, c...)
	}
	return out
}

// Caller must hold hub.mu.
func roundSlots(lobby *game.Lobby) []game.Slot {
	r := lobby.Game.Round
	var slots []game.Slot
	if r.Letters == nil {
		for _, c := range lobby.Categories {
			slots = append(slots, game.Slot{Letter: r.Letter, CategoryID: c.ID, Key: c.ID})
		}
		return slots
	}
	for i, l := range r.Letters {
		for _, c := range lobby.Categories {
			key := sprintKey(i, c.ID)
			for pid, byCat := range r.Answers {
				if byCat[key] != nil && playsThisRound(lobby, lobby.Players[pid]) {
					slots = append(slots, game.Slot{Letter: l, CategoryID: c.ID, Key: key})
					break
				}
			}
		}
	}
	return slots
}

// Caller must hold hub.mu.
func sprintProgress(lobby *game.Lobby, pid string) (*int, []string) {
	r, n := lobby.Game.Round, len(lobby.Categories)
	pos := r.Pos[pid]
	words := []string{}
	for i := 0; i < pos; i++ {
		w := ""
		if a := r.Answers[pid][sprintKey(i/n, lobby.Categories[i%n].ID)]; a != nil {
			w = a.Value
		}
		words = append(words, w)
	}
	return &pos, words
}

// ---- round participation ----
//
// "Is this player in the round?" has three different answers depending on what
// is being asked, and these predicates are the only place the distinction is
// made. Anything that needs to filter players must call one of them rather than
// re-deriving the rule from Left/Pending/Connected - that drift is what let a
// departed player's answers reach scoring while review filtered them out.
//
//	isRoundSpectator  - watches instead of playing this round (commentator host
//	                    or a pending mid-game joiner). Never submits, buzzes,
//	                    is scored, ranked or reviewed.
//	playsThisRound    - the player's answers count *this* round: not left, not a
//	                    spectator. The filter for review, scoring, the
//	                    commentator board and the empty-round check.
//	canPlayNextRound  - could play a round starting *now*: connected, not left,
//	                    not a commentator host. Gates starting a round.
//
// The standings are the deliberate exception: buildRoundResult excludes only
// spectators, because a player who left is kept in the ranking on purpose.

func isSpectatorHost(lobby *game.Lobby, p *game.Player) bool {
	return !lobby.Settings.HostPlays && p.IsHost
}

func isRoundSpectator(lobby *game.Lobby, p *game.Player) bool {
	return isSpectatorHost(lobby, p) || p.Pending
}

// p may be nil: an answer whose player is gone is not in the round.
func playsThisRound(lobby *game.Lobby, p *game.Player) bool {
	return p != nil && !p.Left && !isRoundSpectator(lobby, p)
}

func votesThisRound(lobby *game.Lobby, p *game.Player) bool {
	return playsThisRound(lobby, p) && p.Connected
}

// canPlayNextRound reports whether the player would actually play a round
// starting right now. Pending is deliberately *not* checked: beginCountdown
// clears it as the round starts, so a waiting mid-game joiner does count.
func canPlayNextRound(lobby *game.Lobby, p *game.Player) bool {
	return p != nil && !p.Left && p.Connected && !isSpectatorHost(lobby, p)
}

func soloPlayer(lobby *game.Lobby) *game.Player {
	var solo *game.Player
	for _, p := range lobby.Players {
		if p.Left {
			continue
		}
		if solo != nil {
			return nil
		}
		solo = p
	}
	if solo == nil || isRoundSpectator(lobby, solo) {
		return nil
	}
	return solo
}

// Caller must hold hub.mu.
func hasRoundParticipant(lobby *game.Lobby) bool {
	for _, p := range lobby.Players {
		if canPlayNextRound(lobby, p) {
			return true
		}
	}
	return false
}

// Caller must hold hub.mu.
func hasActiveSubmission(lobby *game.Lobby) bool {
	r := lobby.Game.Round
	for pid, byCat := range r.Answers {
		if !playsThisRound(lobby, lobby.Players[pid]) {
			continue
		}
		for _, ans := range byCat {
			if game.Normalize(ans.Value) != "" {
				return true
			}
		}
	}
	return false
}

// buildCommentatorState never sends answer values. Caller must hold hub.mu.
func buildCommentatorState(lobby *game.Lobby) game.CommentatorStatePayload {
	r := lobby.Game.Round
	players := make([]game.CommentatorPlayer, 0, len(lobby.Players))
	for _, p := range lobby.Players {
		if !playsThisRound(lobby, p) {
			continue
		}
		players = append(players, commentatorRow(lobby, p))
	}
	slices.SortFunc(players, func(a, b game.CommentatorPlayer) int { return cmp.Compare(a.PlayerID, b.PlayerID) })
	return game.CommentatorStatePayload{RoundID: r.ID, Players: players}
}

// Caller must hold hub.mu.
func commentatorRow(lobby *game.Lobby, p *game.Player) game.CommentatorPlayer {
	r := lobby.Game.Round
	filled := make([]string, 0, len(lobby.Categories))
	for _, cat := range lobby.Categories {
		if a := r.Answers[p.ID][cat.ID]; a != nil &&
			game.IsRuleValid(r.Letter, a.Value, lobby.Settings.LastLetterMode) {
			filled = append(filled, cat.ID)
		}
	}
	return game.CommentatorPlayer{
		PlayerID:          p.ID,
		FilledCategoryIDs: filled,
		Complete:          len(filled) == len(lobby.Categories),
	}
}

// Caller must hold hub.mu.
func (hub *Hub) notifyRowLocked(lobby *game.Lobby, p *game.Player, before game.CommentatorPlayer) {
	row := commentatorRow(lobby, p)
	if slices.Equal(row.FilledCategoryIDs, before.FilledCategoryIDs) {
		return
	}
	payload := game.CommentatorUpdatePayload{RoundID: lobby.Game.Round.ID, Player: row}
	for _, cl := range hub.spectatorClients(lobby) {
		cl.send("commentatorUpdate", payload)
	}
}

// Caller must hold hub.mu.
func (hub *Hub) spectatorClients(lobby *game.Lobby) []*Client {
	if lobby.Game == nil || lobby.Game.Round == nil {
		return nil
	}
	var out []*Client
	for _, p := range lobby.Players {
		if p.Left || !isRoundSpectator(lobby, p) {
			continue
		}
		if cl, ok := hub.clients[p.SessionID]; ok {
			out = append(out, cl)
		}
	}
	return out
}

// Caller must NOT hold hub.mu.
func (hub *Hub) notifyCommentator(lobby *game.Lobby) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	viewers := hub.spectatorClients(lobby)
	if len(viewers) == 0 {
		return
	}
	payload := buildCommentatorState(lobby)
	for _, cl := range viewers {
		cl.send("commentatorState", payload)
	}
}

// Caller must hold hub.mu.
func buildGameState(lobby *game.Lobby) game.GameStatePayload {
	g := lobby.Game
	r := g.Round
	p := game.GameStatePayload{
		RoundID:          r.ID,
		State:            string(lobby.State),
		UsedLetters:      g.UsedLetters,
		RemainingLetters: g.RemainingLetters,
		CategoryCount:    len(lobby.Categories),
		Letter:           r.Letter,
		ServerNow:        time.Now().UnixMilli(),
		Letters:          r.Letters,
	}
	if lobby.State == game.StateCountdown {
		rem := countdownSeconds - int(time.Since(r.StartedAt).Seconds())
		if rem < 0 {
			rem = 0
		}
		p.CountdownRemaining = &rem
	} else { // Playing
		if lobby.Settings.TimeLimit != nil && !r.EndsAt.IsZero() {
			endsAt := r.EndsAt.UnixMilli()
			p.EndsAt = &endsAt
		}
	}
	return p
}

// Caller must hold hub.mu.
func buildReviewState(lobby *game.Lobby) game.ReviewStatePayload {
	r := lobby.Game.Round
	idx := r.ReviewIndex
	if idx < 0 || idx >= len(r.Slots) {
		idx = 0
	}
	slot := r.Slots[idx]

	perCat := scoredCategory(lobby, slot.Key)

	answers := make([]game.ReviewAnswer, 0, len(perCat))
	for pid, a := range perCat {
		answers = append(answers, game.ReviewAnswer{
			AnswerID:      pid,
			PlayerID:      pid,
			Value:         a.Value,
			Valid:         a.Counts(),
			MergedInto:    a.MergedInto,
			PointsPreview: a.Points,
			Votes:         a.Votes,
			Ruled:         a.Ruled,
		})
	}
	slices.SortFunc(answers, func(a, b game.ReviewAnswer) int { return cmp.Compare(a.PlayerID, b.PlayerID) })

	ready, voters := []string{}, []string{}
	for _, p := range lobby.Players {
		if votesThisRound(lobby, p) {
			voters = append(voters, p.ID)
			if r.Ready[p.ID] {
				ready = append(ready, p.ID)
			}
		}
	}
	slices.Sort(ready)
	slices.Sort(voters)

	return game.ReviewStatePayload{
		RoundID:       r.ID,
		Letter:        slot.Letter,
		CategoryID:    slot.CategoryID,
		CategoryIndex: idx,
		CategoryCount: len(r.Slots),
		Answers:       answers,
		BuzzedBy:      r.BuzzedBy,
		EndReason:     r.EndReason,
		Ready:         ready,
		Voters:        voters,
	}
}

// scoredCategory returns the answers of a category that count this round, with
// Points set. Review and scoring both use it, so an answer the host cannot see
// in review can never influence the result. Caller must hold hub.mu.
func scoredCategory(lobby *game.Lobby, catID string) map[string]*game.Answer {
	r := lobby.Game.Round
	perCat := map[string]*game.Answer{}
	for pid, byCat := range r.Answers {
		if !playsThisRound(lobby, lobby.Players[pid]) {
			continue
		}
		if a, ok := byCat[catID]; ok {
			perCat[pid] = a
		}
	}
	game.ScoreCategory(perCat)
	return perCat
}

// Caller must hold hub.mu.
func buildRoundResult(lobby *game.Lobby, letter string, entries map[string]game.ScoreEntry, isGameOver bool, reason string) game.RoundResultPayload {
	ranked := make(map[string]*game.Player, len(lobby.Players))
	scores := make([]game.ScoreEntry, 0, len(lobby.Players))
	for pid, pl := range lobby.Players {
		if isRoundSpectator(lobby, pl) {
			continue
		}
		ranked[pid] = pl
		e := entries[pid]
		e.PlayerID, e.TotalPoints = pid, pl.Score
		scores = append(scores, e)
	}
	slices.SortFunc(scores, func(a, b game.ScoreEntry) int { return cmp.Compare(a.PlayerID, b.PlayerID) })
	var used, remaining []string
	if lobby.Game != nil {
		used = lobby.Game.UsedLetters
		remaining = lobby.Game.RemainingLetters
	}
	return game.RoundResultPayload{
		Letter:           letter,
		Scores:           scores,
		Ranking:          game.ComputeRanking(ranked),
		UsedLetters:      used,
		RemainingLetters: remaining,
		IsGameOver:       isGameOver,
		Reason:           reason,
	}
}

// broadcastLocked bumps the lobby version, marshals the message and queues it
// for every connected player. Caller must hold hub.mu; queueing does no I/O, and
// doing it under the lock keeps every client's messages in version order.
func (hub *Hub) broadcastLocked(lobby *game.Lobby, msgType string, payload any) {
	lobby.Version++
	msg, _ := json.Marshal(OutboundMessage{Type: msgType, Payload: payload, StateVersion: lobby.Version})
	for _, p := range lobby.Players {
		if cl, ok := hub.clients[p.SessionID]; ok {
			cl.enqueue(msgType, msg)
		}
	}
}

func (hub *Hub) broadcastTo(lobby *game.Lobby, msgType string, payload any) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	hub.broadcastLocked(lobby, msgType, payload)
}

func (hub *Hub) broadcastGameState(lobby *game.Lobby) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	if lobby.Game == nil || lobby.Game.Round == nil {
		return
	}
	hub.broadcastLocked(lobby, "gameState", buildGameState(lobby))
}

func (hub *Hub) broadcastReviewState(lobby *game.Lobby) {
	hub.mu.Lock()
	defer hub.mu.Unlock()
	if lobby.Game == nil || lobby.Game.Round == nil || len(lobby.Game.Round.Slots) == 0 {
		return
	}
	r := lobby.Game.Round
	hub.broadcastLocked(lobby, "reviewState", buildReviewState(lobby))
	roundID, idx := r.ID, r.ReviewIndex
	time.AfterFunc(reviewHold, func() { hub.advanceReview(lobby, roundID, idx) })
}

func (hub *Hub) sendBuzzRejected(c *Client, reason string) {
	c.send("buzzRejected", map[string]string{"reason": reason})
}

func inRound(lobby *game.Lobby, roundID string) bool {
	return lobby.State == game.StatePlaying && lobby.Game != nil &&
		lobby.Game.Round != nil && lobby.Game.Round.ID == roundID
}

// Players who left mid-game stay for the standings and count only against the larger cap.
func lobbyFull(lobby *game.Lobby) bool {
	active := 0
	for _, p := range lobby.Players {
		if !p.Left {
			active++
		}
	}
	return active >= maxPlayersPerLobby || len(lobby.Players) >= 2*maxPlayersPerLobby
}

// The mode is fixed at game start; before that it previews the lobby.
func soloGame(lobby *game.Lobby) bool {
	if lobby.Game != nil {
		return lobby.Game.Mode == "solo"
	}
	return soloPlayer(lobby) != nil
}
