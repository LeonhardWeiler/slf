package websocket

import (
	"encoding/json"
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
		handleBuzz(hub, c)
	case "setAnswerValidity":
		handleSetAnswerValidity(hub, c, msg.Payload)
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
	}
}

func handleCreateLobby(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		PlayerName string `json:"playerName"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		hub.sendError(c, "Ungültige Anfrage")
		return
	}
	name := strings.TrimSpace(p.PlayerName)
	if utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 20 {
		hub.sendError(c, "Name muss 1–20 Zeichen lang sein")
		return
	}

	playerID := generateID()
	sessionID := generateID()
	lobbyCode := generateLobbyCode()

	session := &game.Session{
		ID:        sessionID,
		PlayerID:  playerID,
		LobbyCode: lobbyCode,
	}

	player := &game.Player{
		ID:        playerID,
		SessionID: sessionID,
		Name:      name,
		IsHost:    true,
		Connected: true,
		Score:     0,
		JoinedAt:  time.Now(),
	}

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
			TimeLimit:                 nil,
			ShowLetterDuringCountdown: true,
			ExcludedLetters:           []string{},
		},
		State:     game.StateLobby,
		CreatedAt: time.Now(),
	}

	hub.mu.Lock()
	hub.rooms.Create(lobby)
	hub.mu.Unlock()

	hub.registerSession(c, session)

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
		hub.sendError(c, "Ungültige Anfrage")
		return
	}

	name := strings.TrimSpace(p.PlayerName)
	if utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 20 {
		hub.sendError(c, "Name muss 1–20 Zeichen lang sein")
		return
	}

	code := strings.TrimSpace(p.LobbyCode)
	if len(code) != 6 {
		hub.sendError(c, "Ungültiger Lobbycode")
		return
	}

	hub.mu.Lock()
	lobby, ok := hub.rooms.Get(code)
	if !ok {
		hub.mu.Unlock()
		hub.sendError(c, "Lobby nicht gefunden")
		return
	}
	if lobby.State != game.StateLobby {
		hub.mu.Unlock()
		hub.sendError(c, "Spiel läuft bereits")
		return
	}
	for _, pl := range lobby.Players {
		if strings.EqualFold(pl.Name, name) {
			hub.mu.Unlock()
			hub.sendError(c, "Name bereits vergeben")
			return
		}
	}

	playerID := generateID()
	sessionID := generateID()

	player := &game.Player{
		ID:        playerID,
		SessionID: sessionID,
		Name:      name,
		IsHost:    false,
		Connected: true,
		Score:     0,
		JoinedAt:  time.Now(),
	}
	lobby.Players[playerID] = player
	hub.mu.Unlock()

	session := &game.Session{
		ID:        sessionID,
		PlayerID:  playerID,
		LobbyCode: code,
	}
	hub.registerSession(c, session)

	c.send("sessionCreated", game.SessionCreatedPayload{
		SessionID: sessionID,
		PlayerID:  playerID,
	})
	hub.broadcastLobbyState(lobby)
}

func handleReconnect(hub *Hub, c *Client, sessionID string) {
	if sessionID == "" {
		hub.sendError(c, "Keine Session-ID")
		return
	}

	hub.mu.Lock()
	session, ok := hub.sessions[sessionID]
	if !ok {
		hub.mu.Unlock()
		hub.sendError(c, "Session nicht gefunden")
		return
	}
	lobby, ok := hub.rooms.Get(session.LobbyCode)
	if !ok {
		hub.mu.Unlock()
		hub.sendError(c, "Lobby nicht mehr vorhanden")
		return
	}
	player, ok := lobby.Players[session.PlayerID]
	if !ok {
		hub.mu.Unlock()
		hub.sendError(c, "Spieler nicht gefunden")
		return
	}
	player.Connected = true

	// replace old client with new connection
	hub.clients[sessionID] = c
	hub.mu.Unlock()

	c.sessionID = sessionID

	c.send("sessionCreated", game.SessionCreatedPayload{
		SessionID: sessionID,
		PlayerID:  session.PlayerID,
	})
	hub.broadcastLobbyState(lobby)
	hub.sendCurrentGameStateTo(c, lobby)
}

// handleLeaveLobby handles an explicit "Verlassen". If the host leaves, the
// whole lobby is closed and every player is returned to the start screen
// (SRS 4.8). A non-host player is simply removed.
func handleLeaveLobby(hub *Hub, c *Client) {
	hub.mu.Lock()
	_, lobby, player, ok := hub.lookupLocked(c.sessionID)
	if !ok {
		hub.mu.Unlock()
		return
	}

	if player.IsHost {
		hub.mu.Unlock()
		hub.closeLobby(lobby, "hostLeft")
		return
	}

	sessionID := c.sessionID
	if lobby.State == game.StateLobby {
		// Pre-game: remove the player entirely.
		delete(lobby.Players, player.ID)
		delete(hub.sessions, sessionID)
		delete(hub.clients, sessionID)
	} else {
		// Mid-game: keep the player in the standings but mark them as left and
		// drop their current-round answers (0 points this round, total kept).
		player.Left = true
		player.Connected = false
		if lobby.Game != nil && lobby.Game.Round != nil {
			delete(lobby.Game.Round.Answers, player.ID)
		}
		delete(hub.clients, sessionID)
	}
	reviewing := lobby.State == game.StateReviewing
	hub.mu.Unlock()

	c.sessionID = ""
	hub.broadcastLobbyState(lobby)
	// While reviewing, the left player's answers must disappear there too.
	if reviewing {
		hub.broadcastReviewState(lobby)
	}
}

// requireHostInLobby validates that the caller is the host of an existing lobby
// that is still in the Lobby state (the only state in which configuration may
// change, SRS 11.3.1). On success it returns the lobby while holding h.mu; the
// caller must unlock. On failure it sends an error, unlocks and returns nil.
func (h *Hub) requireHostInLobby(c *Client) *game.Lobby {
	_, lobby, player, ok := h.lookupLocked(c.sessionID)
	if !ok {
		h.mu.Unlock()
		h.sendError(c, "Sitzung ungültig")
		return nil
	}
	if !player.IsHost {
		h.mu.Unlock()
		h.sendError(c, "Nur der Host darf diese Aktion ausführen")
		return nil
	}
	if lobby.State != game.StateLobby {
		h.mu.Unlock()
		h.sendError(c, "Nicht im Lobby-Zustand erlaubt")
		return nil
	}
	return lobby
}

func handleAddCategory(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		hub.sendError(c, "Ungültige Anfrage")
		return
	}
	name := strings.TrimSpace(p.Name)
	if utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 30 {
		hub.sendError(c, "Kategorie muss 1–30 Zeichen lang sein")
		return
	}

	hub.mu.Lock()
	lobby := hub.requireHostInLobby(c)
	if lobby == nil {
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
		hub.sendError(c, "Ungültige Anfrage")
		return
	}
	name := strings.TrimSpace(p.Name)
	if utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 30 {
		hub.sendError(c, "Kategorie muss 1–30 Zeichen lang sein")
		return
	}

	hub.mu.Lock()
	lobby := hub.requireHostInLobby(c)
	if lobby == nil {
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
		hub.sendError(c, "Kategorie nicht gefunden")
		return
	}
	hub.broadcastLobbyState(lobby)
}

func handleDeleteCategory(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		CategoryID string `json:"categoryId"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		hub.sendError(c, "Ungültige Anfrage")
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
		hub.sendError(c, "Kategorie nicht gefunden")
		return
	}
	hub.broadcastLobbyState(lobby)
}

func handleUpdateSettings(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		TimeLimit                 *int     `json:"timeLimit"`
		ShowLetterDuringCountdown bool     `json:"showLetterDuringCountdown"`
		ExcludedLetters           []string `json:"excludedLetters"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		hub.sendError(c, "Ungültige Anfrage")
		return
	}
	if p.TimeLimit != nil && (*p.TimeLimit < 5 || *p.TimeLimit > 3600) {
		hub.sendError(c, "Zeitlimit muss zwischen 5 und 3600 Sekunden liegen")
		return
	}

	// Sanitize excluded letters: only A–Z, uppercased and de-duplicated. At
	// least one letter must remain playable.
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
	if len(excluded) >= 26 {
		hub.sendError(c, "Mindestens ein Buchstabe muss aktiv bleiben")
		return
	}

	hub.mu.Lock()
	lobby := hub.requireHostInLobby(c)
	if lobby == nil {
		return
	}
	lobby.Settings.TimeLimit = p.TimeLimit
	lobby.Settings.ShowLetterDuringCountdown = p.ShowLetterDuringCountdown
	lobby.Settings.ExcludedLetters = excluded
	hub.mu.Unlock()

	hub.broadcastLobbyState(lobby)
}

func handleKickPlayer(hub *Hub, c *Client, raw json.RawMessage) {
	var p struct {
		PlayerID string `json:"playerId"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		hub.sendError(c, "Ungültige Anfrage")
		return
	}

	hub.mu.Lock()
	_, lobby, host, ok := hub.lookupLocked(c.sessionID)
	if !ok || !host.IsHost || lobby.State != game.StateLobby {
		hub.mu.Unlock()
		hub.sendError(c, "Aktion nicht erlaubt")
		return
	}
	if p.PlayerID == host.ID {
		hub.mu.Unlock()
		hub.sendError(c, "Du kannst dich nicht selbst kicken")
		return
	}
	target, ok := lobby.Players[p.PlayerID]
	if !ok {
		hub.mu.Unlock()
		hub.sendError(c, "Spieler nicht gefunden")
		return
	}
	targetSession := target.SessionID
	targetClient := hub.clients[targetSession]
	delete(lobby.Players, p.PlayerID)
	delete(hub.sessions, targetSession)
	delete(hub.clients, targetSession)
	hub.mu.Unlock()

	if targetClient != nil {
		targetClient.sessionID = ""
		targetClient.send("playerKicked", map[string]string{"playerId": p.PlayerID})
	}
	hub.broadcastLobbyState(lobby)
}
