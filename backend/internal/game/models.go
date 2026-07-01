package game

import "time"

type Player struct {
	ID        string `json:"id"`
	SessionID string `json:"sessionId"`
	Name      string `json:"name"`
	IsHost    bool   `json:"isHost"`
	Connected bool   `json:"connected"`
	// Left is true when the player left an in-progress game. They are kept in
	// the standings but excluded from review and the lobby player list.
	Left     bool      `json:"left"`
	Score    int       `json:"score"`
	JoinedAt time.Time `json:"joinedAt"`
}

type Category struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Settings struct {
	TimeLimit                 *int `json:"timeLimit"`
	ShowLetterDuringCountdown bool `json:"showLetterDuringCountdown"`
	// ExcludedLetters are letters the host disabled; they are never drawn.
	ExcludedLetters []string `json:"excludedLetters"`
	// HostPlays controls whether the host participates. When false the host is a
	// pure commentator: no answers, excluded from scoring/ranking, and shown a
	// per-player completion overview during play (for a beamer setup).
	HostPlays bool `json:"hostPlays"`
	// LastLetterMode makes answers have to *end* with the drawn letter instead of
	// starting with it (a "spice" the host can enable).
	LastLetterMode bool `json:"lastLetterMode"`
	// FlamesEnabled lets each player bet, once per round, that their answer for a
	// category is unique (a "flame"): if right +5, if wrong 0.
	FlamesEnabled bool `json:"flamesEnabled"`
}

type Lobby struct {
	Code       string             `json:"code"`
	HostID     string             `json:"hostId"`
	Players    map[string]*Player `json:"-"`
	Categories []*Category        `json:"categories"`
	Settings   Settings           `json:"settings"`
	State      GameState          `json:"state"`
	Game       *Game              `json:"-"`
	CreatedAt  time.Time          `json:"createdAt"`
	// Version is a monotonic counter bumped on every state broadcast and sent
	// with each server→client state message (SRS 9.15.2 stateVersion) for
	// consistency/debugging.
	Version int `json:"-"`
	// EmptySince is set (by the janitor) to when the lobby last had zero connected
	// players, and cleared while anyone is connected. Abandoned lobbies past a TTL
	// are reaped so memory is not held forever.
	EmptySince time.Time `json:"-"`
	// HostGraceUntil is the deadline by which the disconnected host must return
	// before the lobby is closed (SRS 4.6/8.5); zero when the host is present. It
	// is included in the lobby state so late/reconnecting clients also see the
	// shared countdown.
	HostGraceUntil time.Time `json:"-"`
}

// Answer is a single player's entry for one category in a round.
type Answer struct {
	Value string `json:"value"`
	Valid bool   `json:"valid"`
	// MergedInto, if set, points at the categoryId-scoped answer key of the
	// answer this one was merged into during review (treated as identical).
	MergedInto string `json:"mergedInto"`
	Points     int    `json:"points"`
}

// Round is one letter: its answers, buzz state and timing.
type Round struct {
	ID     string `json:"id"`
	Letter string `json:"letter"`
	// Answers[playerID][categoryID] = answer
	Answers map[string]map[string]*Answer `json:"-"`
	// EndsAt is the round deadline when a time limit is set (zero = unlimited).
	EndsAt    time.Time `json:"-"`
	StartedAt time.Time `json:"-"`
	// ReviewIndex is the category currently under review.
	ReviewIndex int `json:"-"`
	// Flames maps a playerID to the categoryID they "flamed" this round (a bet
	// that their answer is unique). At most one entry per player = one flame per
	// round. Only meaningful when Settings.FlamesEnabled.
	Flames map[string]string `json:"-"`
}

// Game is a sequence of rounds over a fresh alphabet within one lobby.
type Game struct {
	UsedLetters      []string `json:"usedLetters"`
	RemainingLetters []string `json:"remainingLetters"`
	Round            *Round   `json:"-"`
	// LastResult is kept so a reconnecting client can be shown the current
	// RoundResult / GameOver screen.
	LastResult *RoundResultPayload `json:"-"`
}

type Session struct {
	ID        string
	PlayerID  string
	LobbyCode string
}

// LobbyPlayer is the public, broadcast-safe view of a player. It deliberately
// omits SessionID (an auth secret that must never reach other clients) and the
// internal JoinedAt, matching the SRS 9.15.3 player shape.
type LobbyPlayer struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	IsHost    bool   `json:"isHost"`
	Connected bool   `json:"connected"`
	Left      bool   `json:"left"`
	Score     int    `json:"score"`
}

type LobbyStatePayload struct {
	LobbyCode  string        `json:"lobbyCode"`
	HostID     string        `json:"hostId"`
	Players    []LobbyPlayer `json:"players"`
	Categories []*Category   `json:"categories"`
	Settings   Settings      `json:"settings"`
	State      GameState     `json:"state"`
	// HostGraceSeconds is the seconds left until the lobby closes because the
	// host is disconnected; nil when the host is present. Lets late/reconnecting
	// clients render the shared countdown too.
	HostGraceSeconds *int `json:"hostGraceSeconds"`
}

type SessionCreatedPayload struct {
	SessionID string `json:"sessionId"`
	PlayerID  string `json:"playerId"`
}

// GameStatePayload is the shared, non-secret view of the active round.
// Per-player draft answers are NOT included (they stay private and are kept
// client-side in localStorage, SRS 5.6).
type GameStatePayload struct {
	RoundID            string   `json:"roundId"`
	State              string   `json:"state"`  // "Countdown" | "Playing"
	Letter             string   `json:"letter"` // "" while hidden during countdown
	UsedLetters        []string `json:"usedLetters"`
	RemainingLetters   []string `json:"remainingLetters"`
	TimeRemaining      *int     `json:"timeRemaining"`      // seconds, null = unlimited
	CountdownRemaining *int     `json:"countdownRemaining"` // seconds, null when Playing
	Elapsed            *int     `json:"elapsed"`            // seconds since playing start, null outside Playing
	CategoryCount      int      `json:"categoryCount"`
}

type ReviewAnswer struct {
	AnswerID      string `json:"answerId"` // = playerId (one answer per player/category)
	PlayerID      string `json:"playerId"`
	Value         string `json:"value"`
	Valid         bool   `json:"valid"`
	MergedInto    string `json:"mergedInto"`
	PointsPreview int    `json:"pointsPreview"`
	// Flamed is true when this player bet (flamed) that their answer is unique.
	Flamed bool `json:"flamed"`
}

type ReviewStatePayload struct {
	RoundID       string         `json:"roundId"`
	Letter        string         `json:"letter"`
	CategoryID    string         `json:"categoryId"`
	CategoryIndex int            `json:"categoryIndex"`
	CategoryCount int            `json:"categoryCount"`
	Answers       []ReviewAnswer `json:"answers"`
}

type ScoreEntry struct {
	PlayerID    string `json:"playerId"`
	RoundPoints int    `json:"roundPoints"`
	TotalPoints int    `json:"totalPoints"`
}

type RankEntry struct {
	PlayerID string `json:"playerId"`
	Rank     int    `json:"rank"`
	Score    int    `json:"score"`
}

type RoundResultPayload struct {
	Letter           string       `json:"letter"`
	Scores           []ScoreEntry `json:"scores"`
	Ranking          []RankEntry  `json:"ranking"`
	UsedLetters      []string     `json:"usedLetters"`
	RemainingLetters []string     `json:"remainingLetters"`
	IsGameOver       bool         `json:"isGameOver"`
	// Reason is set only when IsGameOver (SRS 9.15.14):
	// "AlphabetFinished" | "HostEnded". HostDisconnected is not used since the
	// host-disconnect timeout is intentionally not implemented (see TODO B1).
	Reason string `json:"reason,omitempty"`
}

// CommentatorPlayer is one player's fill progress in the current round, without
// leaking the answer contents themselves.
type CommentatorPlayer struct {
	PlayerID          string   `json:"playerId"`
	FilledCategoryIDs []string `json:"filledCategoryIds"`
	Complete          bool     `json:"complete"`
}

// CommentatorStatePayload is sent only to a non-playing (commentator) host so it
// can show, on a beamer, who has filled in which categories — never the values.
type CommentatorStatePayload struct {
	RoundID string              `json:"roundId"`
	Players []CommentatorPlayer `json:"players"`
}
