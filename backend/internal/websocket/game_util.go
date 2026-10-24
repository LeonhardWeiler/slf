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
	// authoritatively enforces the 1-30 char limit (SRS 9.13.14) instead of
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
	round.Answers[playerID][catID] = &game.Answer{Value: strings.TrimSpace(value)}
}

// answerFor returns a player's answer (answerID == playerID) for a category.
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

// roundSlots lists what review walks through: every category with the round
// letter, or in a sprint every letter+category pair a player answered.
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

// sprintProgress returns a player's next sprint prompt and their word for each
// prompt before it, "" where they skipped.
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

// isSpectatorHost reports whether the player is a non-playing (commentator) host.
func isSpectatorHost(lobby *game.Lobby, p *game.Player) bool {
	return !lobby.Settings.HostPlays && p.IsHost
}

// isRoundSpectator reports whether the player does not participate in the current
// round and therefore watches instead of playing: a commentator host, or a
// mid-game joiner still pending (waiting to play from the next round).
func isRoundSpectator(lobby *game.Lobby, p *game.Player) bool {
	return isSpectatorHost(lobby, p) || p.Pending
}

// playsThisRound reports whether the player's answers count in the current round.
// Takes a possibly-nil player so callers can pass a raw map lookup: an answer
// whose player is gone from the lobby is not in the round either.
func playsThisRound(lobby *game.Lobby, p *game.Player) bool {
	return p != nil && !p.Left && !isRoundSpectator(lobby, p)
}

// votesThisRound reports whether the player votes on answers in review.
func votesThisRound(lobby *game.Lobby, p *game.Player) bool {
	return playsThisRound(lobby, p) && p.Connected
}

// canPlayNextRound reports whether the player would actually play a round
// starting right now. Pending is deliberately *not* checked: beginCountdown
// clears it as the round starts, so a waiting mid-game joiner does count.
func canPlayNextRound(lobby *game.Lobby, p *game.Player) bool {
	return p != nil && !p.Left && p.Connected && !isSpectatorHost(lobby, p)
}

// soloPlayer returns the only player of a lobby that has exactly one member
// who has not left and who plays, or nil. A pending joiner or a second member
// ends solo, so the game is normal again as soon as someone else joins.
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

// hasRoundParticipant reports whether at least one player could play a round
// starting now. Shared by handleStartGame (so the host gets a real error) and
// beginCountdown (so an empty lobby falls back instead of starting a dead
// round) - the two must not disagree. Caller must hold hub.mu.
func hasRoundParticipant(lobby *game.Lobby) bool {
	for _, p := range lobby.Players {
		if canPlayNextRound(lobby, p) {
			return true
		}
	}
	return false
}

// hasActiveSubmission reports whether at least one player who counts this round
// submitted a non-empty answer. Caller must hold hub.mu.
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

// buildCommentatorState summarises, per playing (non-host, non-left) player,
// which categories they have filled - never the values. Caller must hold hub.mu.
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

// commentatorRow is one player's line of the board. Caller must hold hub.mu.
func commentatorRow(lobby *game.Lobby, p *game.Player) game.CommentatorPlayer {
	r := lobby.Game.Round
	filled := make([]string, 0, len(lobby.Categories))
	for _, cat := range lobby.Categories {
		// A category counts as "done" only when the answer passes the same
		// server-side rule check the player needs to buzz (e.g. "arst" for
		// letter O is not done) - not merely when it is non-empty.
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

// notifyRowLocked sends the spectators p's board row if it differs from
// before. Most keystrokes change nothing on the board and send nothing.
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

// spectatorClients returns every connected client that should watch the round's
// fill-overview board instead of playing: the commentator host and any pending
// (mid-game) joiners. Empty when there is no active round. Caller must hold
// hub.mu.
func (hub *Hub) spectatorClients(lobby *game.Lobby) []*Client {
	if lobby.Game == nil || lobby.Game.Round == nil {
		return nil
	}
	var out []*Client
	for _, p := range lobby.Players {
		// The complement of playsThisRound, minus the players who left: watching
		// requires being a spectator, and a departed player watches nothing.
		if p.Left || !isRoundSpectator(lobby, p) {
			continue
		}
		if cl, ok := hub.clients[p.SessionID]; ok {
			out = append(out, cl)
		}
	}
	return out
}

// notifyCommentator sends the full fill overview to every spectator (the
// commentator host and any pending joiners). Caller must NOT hold hub.mu.
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

// buildReviewState builds the current category's review view (with point
// previews). Caller must hold hub.mu.
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

// buildRoundResult assembles per-player round points, totals and the ranking.
// Caller must hold hub.mu.
func buildRoundResult(lobby *game.Lobby, letter string, entries map[string]game.ScoreEntry, isGameOver bool, reason string) game.RoundResultPayload {
	// The deliberate exception to playsThisRound: only spectators (commentator
	// host, pending joiners) are dropped here. A player who *left* stays in the
	// scores and the ranking on purpose - the standings are where they linger.
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
		Ranking:          game.ComputeRanking(ranked),
		UsedLetters:      used,
		RemainingLetters: remaining,
		IsGameOver:       isGameOver,
		Reason:           reason,
	}
}

// ---- broadcasts ----

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
	hub.broadcastLocked(lobby, "reviewState", buildReviewState(lobby))
}

func (hub *Hub) sendBuzzRejected(c *Client, reason string) {
	c.send("buzzRejected", map[string]string{"reason": reason})
}

// inRound reports whether the lobby is playing the round with this id.
func inRound(lobby *game.Lobby, roundID string) bool {
	return lobby.State == game.StatePlaying && lobby.Game != nil &&
		lobby.Game.Round != nil && lobby.Game.Round.ID == roundID
}

// lobbyFull reports whether a lobby takes no more joiners. Players who left
// mid-game stay for the standings and count only against the larger cap.
func lobbyFull(lobby *game.Lobby) bool {
	active := 0
	for _, p := range lobby.Players {
		if !p.Left {
			active++
		}
	}
	return active >= maxPlayersPerLobby || len(lobby.Players) >= 2*maxPlayersPerLobby
}
