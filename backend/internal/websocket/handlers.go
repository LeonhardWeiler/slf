package websocket

import (
	"encoding/json"
	"log/slog"
	"strings"
	"time"
	"unicode/utf8"

	"slf/internal/game"
)

func handleMessage(hub *Hub, c *Client, msg InboundMessage) {
	switch msg.Type {
	case "createLobby":
		handleCreateLobby(hub, c, msg.Payload)
	case "joinLobby":
		handleJoinLobby(hub, c, msg.Payload)
	case "checkLobby":
		handleCheckLobby(hub, c, msg.Payload)
	case "reconnect":
		handleReconnect(hub, c, msg.SessionID)
	case "leaveLobby":
		handleLeaveLobby(hub, c)
	case "addCategory":
		handleAddCategory(hub, c, msg.Payload)
	case "editCategory":
		handleEditCategory(hub, c, msg.Payload)
	case "deleteCategory":
		handleDeleteCategory(hub, c, msg.Payload)
	case "updateSettings":
		handleUpdateSettings(hub, c, msg.Payload)
	case "kickPlayer":
		handleKickPlayer(hub, c, msg.Payload)
	case "startGame":
		handleStartGame(hub, c)
	case "answerUpdate":
		handleAnswerUpdate(hub, c, msg.Payload)
	case "inputSync":
		handleInputSync(hub, c, msg.Payload)
	case "buzz":
		handleBuzz(hub, c, msg.Payload)
	case "endRound":
		handleEndRound(hub, c)
	case "sprintWord":
		handleSprintWord(hub, c, msg.Payload)
	case "setAnswerValidity":
		handleSetAnswerValidity(hub, c, msg.Payload)
	case "voteAnswer":
		handleVoteAnswer(hub, c, msg.Payload)
	case "reviewReady":
		handleReviewReady(hub, c)
	case "mergeAnswers":
		handleMergeAnswers(hub, c, msg.Payload)
	case "unmergeAnswers":
		handleUnmergeAnswers(hub, c, msg.Payload)
	case "nextCategory":
		handleNextCategory(hub, c)
	case "previousCategory":
		handlePreviousCategory(hub, c)
	case "finishReview":
		handleFinishReview(hub, c)
	case "startNextRound":
		handleStartNextRound(hub, c)
	case "endGame":
		handleEndGame(hub, c)
	case "returnToLobby":
		handleReturnToLobby(hub, c)
	case "ping":
		c.send("pong", struct{}{})
	}
}

func handleCreateLobby(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		PlayerName string `json:"playerName"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		hub.sendError(c, CodeValidationError, "Ungültige Anfrage.")
		return
	}
	name := cleanName(p.PlayerName)
	if n := utf8.RuneCountInString(name); n < 1 {
		hub.sendError(c, CodeNameTooShort, "Name muss mindestens 1 Zeichen lang sein.")
		return
	} else if n > 20 {
		hub.sendError(c, CodeNameTooLong, "Name darf höchstens 20 Zeichen lang sein.")
		return
	}

	if c.seatThrottled() {
		hub.sendError(c, CodeValidationError, "Zu viele neue Lobbys - bitte kurz warten.")
		return
	}

	playerID := generateID()
	sessionID := generateSessionID()

	player := &game.Player{
		ID:        playerID,
		SessionID: sessionID,
		Name:      name,
		IsHost:    true,
		Connected: true,
		Score:     0,
		JoinedAt:  time.Now(),
	}

	hub.releaseSeat(c, sessionID)
	hub.mu.Lock()
	if len(hub.rooms) >= maxLobbies {
		hub.mu.Unlock()
		hub.sendError(c, CodeValidationError, "Server ausgelastet - bitte später erneut versuchen.")
		return
	}
	lobbyCode := hub.uniqueLobbyCode()
	lobby := &game.Lobby{
		Code:   lobbyCode,
		HostID: playerID,
		Players: map[string]*game.Player{
			playerID: player,
		},
		Categories: []*game.Category{
			{ID: generateID(), Name: "Stadt"},
			{ID: generateID(), Name: "Land"},
			{ID: generateID(), Name: "Fluss"},
		},
		Settings: game.Settings{
			TimeLimit:       nil,
			ExcludedLetters: []string{},
			HostPlays:       true,
			LastLetterMode:  false,
		},
		State:     game.StateLobby,
		CreatedAt: time.Now(),
	}
	hub.rooms[lobby.Code] = lobby
	hub.sessions[sessionID] = &game.Session{ID: sessionID, PlayerID: playerID, LobbyCode: lobbyCode}
	hub.bindLocked(c, sessionID)
	hub.mu.Unlock()
	c.tookSeat()

	slog.Info("lobby created", "lobby", lobbyCode, "host", name)

	c.send("sessionCreated", game.SessionCreatedPayload{
		SessionID: sessionID,
		PlayerID:  playerID,
	})
	hub.broadcastLobbyState(lobby)
}

func handleJoinLobby(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		PlayerName string `json:"playerName"`
		LobbyCode  string `json:"lobbyCode"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		hub.sendError(c, CodeValidationError, "Ungültige Anfrage.")
		return
	}

	name := cleanName(p.PlayerName)
	if n := utf8.RuneCountInString(name); n < 1 {
		hub.sendError(c, CodeNameTooShort, "Name muss mindestens 1 Zeichen lang sein.")
		return
	} else if n > 20 {
		hub.sendError(c, CodeNameTooLong, "Name darf höchstens 20 Zeichen lang sein.")
		return
	}

	if wait := backoff(c.joinFails); wait > 0 && time.Since(c.lastJoinAt) < wait {
		c.lastJoinAt = time.Now()
		hub.sendError(c, CodeValidationError, "Zu viele Beitritts-Versuche - bitte kurz warten.")
		return
	}
	c.lastJoinAt = time.Now()
	if c.seatThrottled() {
		hub.sendError(c, CodeValidationError, "Zu viele Beitritte - bitte kurz warten.")
		return
	}

	code, ok := normalizeLobbyCode(p.LobbyCode)
	if !ok {
		c.joinFails++
		hub.sendError(c, CodeInvalidLobbyCode, "Ungültiger Lobbycode.")
		return
	}

	playerID := generateID()
	sessionID := generateSessionID()
	hub.releaseSeat(c, sessionID)
	hub.mu.Lock()
	lobby, found := hub.rooms[code]
	if !found {
		hub.mu.Unlock()
		c.joinFails++
		hub.sendError(c, CodeLobbyNotFound, "Lobby nicht gefunden.")
		return
	}
	c.joinFails = 0
	if lobbyFull(lobby) {
		hub.mu.Unlock()
		hub.sendError(c, CodeValidationError, "Lobby ist voll.")
		return
	}
	for _, pl := range lobby.Players {
		if !pl.Left && strings.EqualFold(pl.Name, name) {
			hub.mu.Unlock()
			hub.sendError(c, CodeNameNotUnique, "Name bereits vergeben.")
			return
		}
	}

	pending := lobby.State != game.StateLobby

	player := &game.Player{
		ID:        playerID,
		SessionID: sessionID,
		Name:      name,
		IsHost:    false,
		Connected: true,
		Pending:   pending,
		Score:     0,
		JoinedAt:  time.Now(),
	}
	lobby.Players[playerID] = player
	hub.sessions[sessionID] = &game.Session{ID: sessionID, PlayerID: playerID, LobbyCode: code}
	hub.bindLocked(c, sessionID)
	hub.mu.Unlock()
	c.tookSeat()

	slog.Info("player joined", "lobby", code, "player", name, "pending", pending)

	c.send("sessionCreated", game.SessionCreatedPayload{
		SessionID: sessionID,
		PlayerID:  playerID,
	})
	hub.broadcastLobbyState(lobby)
	if pending {
		hub.sendCurrentGameStateTo(c, lobby)
	}
}

// handleCheckLobby shares handleJoinLobby's throttle so it cannot become an unthrottled oracle for lobby codes.
func handleCheckLobby(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		LobbyCode string `json:"lobbyCode"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		hub.sendError(c, CodeValidationError, "Ungültige Anfrage.")
		return
	}

	respond := func(available bool, reason string) {
		c.send("lobbyCheck", struct {
			LobbyCode string `json:"lobbyCode"`
			Available bool   `json:"available"`
			Reason    string `json:"reason,omitempty"`
		}{LobbyCode: p.LobbyCode, Available: available, Reason: reason})
	}

	if wait := backoff(c.joinFails); wait > 0 && time.Since(c.lastJoinAt) < wait {
		c.lastJoinAt = time.Now()
		respond(false, "throttled")
		return
	}
	c.lastJoinAt = time.Now()

	code, ok := normalizeLobbyCode(p.LobbyCode)
	if !ok {
		c.joinFails++
		respond(false, "invalidCode")
		return
	}

	hub.mu.Lock()
	lobby, found := hub.rooms[code]
	if !found {
		hub.mu.Unlock()
		c.joinFails++
		respond(false, "notFound")
		return
	}
	c.joinFails = 0
	full := lobbyFull(lobby)
	hub.mu.Unlock()

	if full {
		respond(false, "full")
		return
	}
	respond(true, "")
}

func handleReconnect(hub *Hub, c *Client, sessionID string) {
	if sessionID == "" {
		hub.sendError(c, CodeInvalidSession, "Keine Session-ID.")
		return
	}
	hub.releaseSeat(c, sessionID)

	hub.mu.Lock()
	session, ok := hub.sessions[sessionID]
	if !ok {
		hub.mu.Unlock()
		hub.sendError(c, CodeSessionNotFound, "Session nicht gefunden.")
		return
	}
	lobby, ok := hub.rooms[session.LobbyCode]
	if !ok {
		hub.mu.Unlock()
		hub.sendError(c, CodeLobbyNotFound, "Lobby nicht mehr vorhanden.")
		return
	}
	player, ok := lobby.Players[session.PlayerID]
	if !ok {
		hub.mu.Unlock()
		hub.sendError(c, CodePlayerNotFound, "Spieler nicht gefunden.")
		return
	}
	if player.Left {
		hub.mu.Unlock()
		hub.sendError(c, CodeSessionNotFound, "Session nicht mehr gültig.")
		return
	}
	player.Connected = true

	// The old socket's onDisconnect is a no-op thanks to the identity guard.
	old := hub.bindLocked(c, sessionID)
	slog.Info("player reconnected", "lobby", lobby.Code, "player", player.Name)
	hub.mu.Unlock()

	if old != nil && old != c {
		go old.conn.Close(statusReplaced, "replaced by reconnect")
	}

	c.send("sessionCreated", game.SessionCreatedPayload{
		SessionID: sessionID,
		PlayerID:  session.PlayerID,
	})
	if player.IsHost && hub.cancelHostGrace(lobby.Code) {
		slog.Info("host reconnected in time", "lobby", lobby.Code)
		hub.broadcastTo(lobby, "hostReconnected", map[string]string{})
	}
	hub.broadcastLobbyState(lobby)
	hub.sendCurrentGameStateTo(c, lobby)
}

func handleLeaveLobby(hub *Hub, c *Client) {
	hub.mu.Lock()
	_, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok {
		hub.mu.Unlock()
		return
	}
	slog.Info("player left", "lobby", lobby.Code, "player", player.Name, "host", player.IsHost)

	if player.IsHost {
		hub.mu.Unlock()
		hub.closeLobby(lobby, "hostLeft")
		return
	}

	sessionID := c.sessionID
	if lobby.State == game.StateLobby {
		delete(lobby.Players, player.ID)
	} else {
		markLeft(lobby, player)
	}
	hub.endSessionLocked(sessionID)
	reviewing := lobby.State == game.StateReviewing
	hub.mu.Unlock()

	hub.broadcastLobbyState(lobby)
	if reviewing {
		hub.broadcastReviewState(lobby)
	}
}

// markLeft keeps a departing player in the standings (0 points this round,
// total kept) but takes them out of the current round: their answers and their
// votes on other answers go.
func markLeft(lobby *game.Lobby, p *game.Player) {
	p.Left = true
	p.Connected = false
	if lobby.Game == nil || lobby.Game.Round == nil {
		return
	}
	r := lobby.Game.Round
	delete(r.Answers, p.ID)
	for _, answers := range r.Answers {
		for _, a := range answers {
			delete(a.Votes, p.ID)
		}
	}
}

// On success requireHostInLobby returns holding h.mu; the caller must unlock. On failure it sends an error, unlocks and returns nil.
func (h *Hub) requireHostInLobby(c *Client) *game.Lobby {
	_, lobby, player, ok := h.lookupLocked(c.sessionID)
	if !ok {
		h.mu.Unlock()
		h.sendError(c, CodeInvalidSession, "Sitzung ungültig.")
		return nil
	}
	if !player.IsHost {
		h.mu.Unlock()
		h.sendError(c, CodeNotHost, "Nur der Host darf diese Aktion ausführen.")
		return nil
	}
	if lobby.State != game.StateLobby {
		h.mu.Unlock()
		h.sendError(c, CodeInvalidState, "Nicht im Lobby-Zustand erlaubt.")
		return nil
	}
	return lobby
}

func handleAddCategory(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		hub.sendError(c, CodeValidationError, "Ungültige Anfrage.")
		return
	}
	name := cleanName(p.Name)
	if utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 30 {
		hub.sendError(c, CodeValidationError, "Kategorie muss 1-30 Zeichen lang sein.")
		return
	}

	hub.mu.Lock()
	lobby := hub.requireHostInLobby(c)
	if lobby == nil {
		return
	}
	if categoryTaken(lobby, "", name) {
		hub.mu.Unlock()
		hub.sendError(c, CodeValidationError, "Kategorie gibt es schon.")
		return
	}
	if len(lobby.Categories) >= maxCategoriesPerLobby {
		hub.mu.Unlock()
		hub.sendError(c, CodeValidationError, "Maximale Anzahl Kategorien erreicht.")
		return
	}
	lobby.Categories = append(lobby.Categories, &game.Category{
		ID:   generateID(),
		Name: name,
	})
	hub.mu.Unlock()

	hub.broadcastLobbyState(lobby)
}

func handleEditCategory(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		CategoryID string `json:"categoryId"`
		Name       string `json:"name"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		hub.sendError(c, CodeValidationError, "Ungültige Anfrage.")
		return
	}
	name := cleanName(p.Name)
	if utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 30 {
		hub.sendError(c, CodeValidationError, "Kategorie muss 1-30 Zeichen lang sein.")
		return
	}

	hub.mu.Lock()
	lobby := hub.requireHostInLobby(c)
	if lobby == nil {
		return
	}
	if categoryTaken(lobby, p.CategoryID, name) {
		hub.mu.Unlock()
		hub.sendError(c, CodeValidationError, "Kategorie gibt es schon.")
		return
	}
	found := false
	for _, cat := range lobby.Categories {
		if cat.ID == p.CategoryID {
			cat.Name = name
			found = true
			break
		}
	}
	hub.mu.Unlock()

	if !found {
		hub.sendError(c, CodeCategoryNotFound, "Kategorie nicht gefunden.")
		return
	}
	hub.broadcastLobbyState(lobby)
}

func categoryTaken(lobby *game.Lobby, exceptID, name string) bool {
	for _, cat := range lobby.Categories {
		if cat.ID != exceptID && strings.EqualFold(cat.Name, name) {
			return true
		}
	}
	return false
}

func handleDeleteCategory(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		CategoryID string `json:"categoryId"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		hub.sendError(c, CodeValidationError, "Ungültige Anfrage.")
		return
	}

	hub.mu.Lock()
	lobby := hub.requireHostInLobby(c)
	if lobby == nil {
		return
	}
	next := lobby.Categories[:0]
	removed := false
	for _, cat := range lobby.Categories {
		if cat.ID == p.CategoryID {
			removed = true
			continue
		}
		next = append(next, cat)
	}
	lobby.Categories = next
	hub.mu.Unlock()

	if !removed {
		hub.sendError(c, CodeCategoryNotFound, "Kategorie nicht gefunden.")
		return
	}
	hub.broadcastLobbyState(lobby)
}

func handleUpdateSettings(hub *Hub, c *Client, raw json.RawMessage) {
	// present tells an omitted key from null: timeLimit=null means no limit, an absent key keeps the current value.
	var present map[string]json.RawMessage
	if err := json.Unmarshal(raw, &present); err != nil {
		hub.sendError(c, CodeValidationError, "Ungültige Anfrage.")
		return
	}
	var p struct {
		TimeLimit       *int     `json:"timeLimit"`
		ExcludedLetters []string `json:"excludedLetters"`
		HostPlays       *bool    `json:"hostPlays"`
		LastLetterMode  *bool    `json:"lastLetterMode"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		hub.sendError(c, CodeValidationError, "Ungültige Anfrage.")
		return
	}

	_, hasTimeLimit := present["timeLimit"]
	if hasTimeLimit && p.TimeLimit != nil && (*p.TimeLimit < 5 || *p.TimeLimit > 3600) {
		hub.sendError(c, CodeValidationError, "Zeitlimit muss zwischen 5 und 3600 Sekunden liegen.")
		return
	}

	_, hasExcluded := present["excludedLetters"]
	seen := map[string]bool{}
	excluded := make([]string, 0, len(p.ExcludedLetters))
	for _, l := range p.ExcludedLetters {
		u := strings.ToUpper(strings.TrimSpace(l))
		if len(u) != 1 || u < "A" || u > "Z" || seen[u] {
			continue
		}
		seen[u] = true
		excluded = append(excluded, u)
	}
	if hasExcluded && len(excluded) >= 26 {
		hub.sendError(c, CodeValidationError, "Mindestens ein Buchstabe muss aktiv bleiben.")
		return
	}

	hub.mu.Lock()
	lobby := hub.requireHostInLobby(c)
	if lobby == nil {
		return
	}
	if hasTimeLimit {
		lobby.Settings.TimeLimit = p.TimeLimit
	}
	if hasExcluded {
		lobby.Settings.ExcludedLetters = excluded
	}
	if p.HostPlays != nil {
		lobby.Settings.HostPlays = *p.HostPlays
	}
	if p.LastLetterMode != nil {
		lobby.Settings.LastLetterMode = *p.LastLetterMode
	}
	hub.mu.Unlock()

	hub.broadcastLobbyState(lobby)
}

func handleKickPlayer(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		PlayerID string `json:"playerId"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		hub.sendError(c, CodeValidationError, "Ungültige Anfrage.")
		return
	}

	hub.mu.Lock()
	_, lobby, host, ok := hub.lookupLocked(c.sessionID)
	if !ok || !host.IsHost {
		hub.mu.Unlock()
		hub.sendError(c, CodeNotHost, "Aktion nicht erlaubt.")
		return
	}
	if p.PlayerID == host.ID {
		hub.mu.Unlock()
		hub.sendError(c, CodeValidationError, "Du kannst dich nicht selbst kicken.")
		return
	}
	target, ok := lobby.Players[p.PlayerID]
	if !ok {
		hub.mu.Unlock()
		hub.sendError(c, CodePlayerNotFound, "Spieler nicht gefunden.")
		return
	}
	targetSession := target.SessionID
	targetClient := hub.clients[targetSession]
	if lobby.State == game.StateLobby {
		delete(lobby.Players, p.PlayerID)
	} else {
		markLeft(lobby, target)
	}
	hub.endSessionLocked(targetSession)
	reviewing := lobby.State == game.StateReviewing
	slog.Info("player kicked", "lobby", lobby.Code, "player", target.Name, "state", string(lobby.State))
	hub.mu.Unlock()

	if targetClient != nil {
		targetClient.send("playerKicked", map[string]string{"playerId": p.PlayerID})
	}
	hub.broadcastLobbyState(lobby)
	if reviewing {
		hub.broadcastReviewState(lobby)
	}
}
