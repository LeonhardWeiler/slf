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
	Left bool `json:"left"`
	// Pending is true for a player who joined while a game was already running.
	// They wait as a spectator (seeing the fill overview, never buzzing/scoring)
	// and are cleared to a full participant when the next round begins. Excluded
	// from scoring, ranking and review while pending.
	Pending  bool      `json:"pending"`
	Score    int       `json:"score"`
	JoinedAt time.Time `json:"joinedAt"`
}

type Category struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Settings struct {
	TimeLimit *int `json:"timeLimit"`
	// ExcludedLetters are letters the host disabled; they are never drawn.
	ExcludedLetters []string `json:"excludedLetters"`
	// HostPlays controls whether the host participates. When false the host is a
	// pure commentator: no answers, excluded from scoring/ranking, and shown a
	// per-player completion overview during play (for a beamer setup).
	HostPlays bool `json:"hostPlays"`
	// LastLetterMode makes answers have to *end* with the drawn letter instead of
	// starting with it (a "spice" the host can enable).
	LastLetterMode bool `json:"lastLetterMode"`
	// Sprint plays one timed round over a letter sequence, one prompt at a time.
	Sprint bool `json:"sprint"`
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
	// with each server->client state message (SRS 9.15.2 stateVersion) for
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
	// SentPlayers is the player list of the last lobbyState broadcast, the
	// base of the next lobbyPatch.
	SentPlayers []LobbyPlayer `json:"-"`
}

// Answer is a single player's entry for one category in a round.
type Answer struct {
	Value string `json:"value"`
	Valid bool   `json:"valid"`
	// MergedInto, if set, points at the categoryId-scoped answer key of the
	// answer this one was merged into during review (treated as identical).
	MergedInto string `json:"mergedInto"`
	Points     int    `json:"points"`
	// Votes maps a voter's playerID to a thumbs-up (true) or thumbs-down.
	Votes map[string]bool `json:"-"`
	// Ruled is set once the host overrode Valid; votes no longer matter then.
	Ruled bool `json:"-"`
}

// Counts reports whether the answer is valid after voting: an unruled,
// rule-valid answer stands until someone votes it down, then it needs more
// up than down votes.
func (a *Answer) Counts() bool {
	if a.Ruled || !a.Valid {
		return a.Valid
	}
	up, down := 0, 0
	for _, v := range a.Votes {
		if v {
			up++
		} else {
			down++
		}
	}
	return down == 0 || up > down
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
	// ReviewEndsAt is when the review moves past the current slot (zero in solo).
	ReviewEndsAt time.Time `json:"-"`
	// BuzzedBy is the playerID of whoever buzzed to end the round; empty when the
	// round ended by timeout or a host "end round". Surfaced in review so everyone
	// sees who stopped the round.
	BuzzedBy string `json:"-"`
	// EndReason is how the round ended: "timeout", "host" or "buzz".
	EndReason string `json:"-"`
	// Ready holds the voters done with the category under review.
	Ready map[string]bool `json:"-"`
	// Letters is the sprint letter sequence, nil in a classic round. Prompt n
	// is letter Letters[n/len(categories)] with category n%len(categories).
	Letters []string `json:"-"`
	// Pos is each player's next sprint prompt.
	Pos map[string]int `json:"-"`
	// Slots are the letter+category pairs under review, fixed when play ends.
	Slots []Slot `json:"-"`
}

// Slot is one reviewed letter+category pair; Key indexes Round.Answers.
type Slot struct {
	Letter     string
	CategoryID string
	Key        string
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
	// Pending marks a mid-game joiner who is waiting to play from the next round;
	// the client renders them a spectator view and hides them from the standings.
	Pending bool `json:"pending"`
	Score   int  `json:"score"`
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
	// Solo is true while a single player is in the lobby: review shows the whole
	// round on one screen and the scoreboard between rounds is skipped.
	Solo bool `json:"solo"`
}

// LobbyPatchPayload is a lobbyState whose Players holds only the players that
// changed since the previous broadcast; Removed lists the ones that are gone.
type LobbyPatchPayload struct {
	LobbyStatePayload
	Removed []string `json:"removed"`
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
	State              string   `json:"state"` // "Countdown" | "Playing"
	Letter             string   `json:"letter"`
	UsedLetters        []string `json:"usedLetters"`
	RemainingLetters   []string `json:"remainingLetters"`
	EndsAt             *int64   `json:"endsAt"`             // unix ms deadline, null = unlimited
	ServerNow          int64    `json:"serverNow"`          // unix ms at send time
	CountdownRemaining *int     `json:"countdownRemaining"` // seconds, null when Playing
	CategoryCount      int      `json:"categoryCount"`
	// Letters is the sprint letter sequence, empty in a classic round.
	Letters []string `json:"letters"`
	// SprintPos and SprintWords are the receiver's sprint progress, sent only
	// on replay.
	SprintPos   *int     `json:"sprintPos,omitempty"`
	SprintWords []string `json:"sprintWords,omitempty"`
}

type ReviewAnswer struct {
	AnswerID      string          `json:"answerId"` // = playerId (one answer per player/category)
	PlayerID      string          `json:"playerId"`
	Value         string          `json:"value"`
	Valid         bool            `json:"valid"`
	MergedInto    string          `json:"mergedInto"`
	PointsPreview int             `json:"pointsPreview"`
	Votes         map[string]bool `json:"votes"`
	Ruled         bool            `json:"ruled"`
}

type ReviewStatePayload struct {
	RoundID       string         `json:"roundId"`
	Letter        string         `json:"letter"`
	CategoryID    string         `json:"categoryId"`
	CategoryIndex int            `json:"categoryIndex"`
	CategoryCount int            `json:"categoryCount"`
	Answers       []ReviewAnswer `json:"answers"`
	// BuzzedBy is the playerID who buzzed to end the round; empty on timeout or a
	// host-ended round.
	BuzzedBy string `json:"buzzedBy"`
	// EndReason is how the round ended: "timeout", "host" or "buzz".
	EndReason string `json:"endReason"`
	// Solo holds every category of the round with the player's answer; nil
	// unless the lobby is solo.
	Solo []SoloRow `json:"solo"`
	// Ready lists the voters done with this category; Voters all who may vote.
	Ready  []string `json:"ready"`
	Voters []string `json:"voters"`
	// EndsAt is the unix ms when the review moves on; null in solo.
	EndsAt    *int64 `json:"endsAt"`
	ServerNow int64  `json:"serverNow"`
}

type SoloRow struct {
	Key        string `json:"key"`
	Letter     string `json:"letter"`
	CategoryID string `json:"categoryId"`
	Value      string `json:"value"`
	Valid      bool   `json:"valid"`
	Points     int    `json:"points"`
}

type ScoreEntry struct {
	PlayerID    string `json:"playerId"`
	RoundPoints int    `json:"roundPoints"`
	TotalPoints int    `json:"totalPoints"`
	// Points lists the round's scoring answers in slot order.
	Points []int `json:"points,omitempty"`
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
	// Empty marks a round nobody submitted anything in (review was skipped).
	Empty bool `json:"empty,omitempty"`
	// Reason is set only when IsGameOver (SRS 9.15.14):
	// "AlphabetFinished" | "HostEnded". A host disconnect does not produce a
	// GameOver result - after the grace window the lobby is closed instead
	// (hub.onHostGraceExpired -> closeLobby, "hostDisconnected"), so there is no
	// HostDisconnected reason here.
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
// can show, on a beamer, who has filled in which categories - never the values.
type CommentatorStatePayload struct {
	RoundID string              `json:"roundId"`
	Players []CommentatorPlayer `json:"players"`
}

// CommentatorUpdatePayload carries one player's changed row of the board.
type CommentatorUpdatePayload struct {
	RoundID string            `json:"roundId"`
	Player  CommentatorPlayer `json:"player"`
}
