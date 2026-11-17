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
	// Pending is a mid-game joiner, cleared to a player at the next round start.
	Pending bool `json:"pending"`
	Score   int  `json:"score"`
	// Combo counts the rounds in a row the player filled every slot validly.
	Combo    int       `json:"combo"`
	JoinedAt time.Time `json:"joinedAt"`
}

type Category struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Settings struct {
	TimeLimit       *int     `json:"timeLimit"`
	ExcludedLetters []string `json:"excludedLetters"`
	// HostPlays false makes the host a commentator who sees the fill overview.
	HostPlays      bool `json:"hostPlays"`
	LastLetterMode bool `json:"lastLetterMode"`
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
	Version    int                `json:"-"`
	// EmptySince is when the lobby last had no connected player; zero while one is.
	EmptySince time.Time `json:"-"`
	// HostGraceUntil is the deadline for a disconnected host; zero while the host is present.
	HostGraceUntil time.Time `json:"-"`
	// SentPlayers is the player list of the last lobbyState broadcast, the
	// base of the next lobbyPatch.
	SentPlayers []LobbyPlayer `json:"-"`
}

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

type Round struct {
	ID     string `json:"id"`
	Letter string `json:"letter"`
	// Answers[playerID][categoryID] = answer
	Answers map[string]map[string]*Answer `json:"-"`
	// EndsAt is the round deadline when a time limit is set (zero = unlimited).
	EndsAt      time.Time `json:"-"`
	StartedAt   time.Time `json:"-"`
	ReviewIndex int       `json:"-"`
	// BuzzedBy is empty when the round did not end by a buzz.
	BuzzedBy string `json:"-"`
	// EndReason is how the round ended: "timeout", "host", "buzz" or "finished" (sprint done).
	EndReason string `json:"-"`
	// Ready holds the voters done with the category under review.
	Ready map[string]bool `json:"-"`
	// Letters is the sprint letter sequence, nil in a classic round. Prompt n
	// is letter Letters[n/len(categories)] with category n%len(categories).
	Letters []string       `json:"-"`
	Pos     map[string]int `json:"-"`
	// Slots are the letter+category pairs under review, fixed when play ends.
	Slots []Slot `json:"-"`
}

// Slot is one reviewed letter+category pair; Key indexes Round.Answers.
type Slot struct {
	Letter     string
	CategoryID string
	Key        string
}

type Game struct {
	UsedLetters      []string `json:"usedLetters"`
	RemainingLetters []string `json:"remainingLetters"`
	Round            *Round   `json:"-"`
	// LastResult is kept so a reconnecting client can be shown the current
	// RoundResult / GameOver screen.
	LastResult *RoundResultPayload `json:"-"`
	Mode       string              `json:"mode"`
	StartedAt  time.Time           `json:"startedAt"`
}

type Session struct {
	ID        string
	PlayerID  string
	LobbyCode string
}

// LobbyPlayer omits SessionID, an auth secret that must never reach other clients.
type LobbyPlayer struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	IsHost    bool   `json:"isHost"`
	Connected bool   `json:"connected"`
	Left      bool   `json:"left"`
	Pending   bool   `json:"pending"`
	// Plays is playsThisRound: the player's answers count in the current round.
	Plays bool `json:"plays"`
	Score int  `json:"score"`
	Combo int  `json:"combo"`
}

type LobbyStatePayload struct {
	LobbyCode  string        `json:"lobbyCode"`
	HostID     string        `json:"hostId"`
	Players    []LobbyPlayer `json:"players"`
	Categories []*Category   `json:"categories"`
	Settings   Settings      `json:"settings"`
	State      GameState     `json:"state"`
	// HostGraceSeconds is nil when the host is present.
	HostGraceSeconds *int `json:"hostGraceSeconds"`
	// Solo is true in a solo game (or, before a game, while a single player is
	// in the lobby): every round is a sprint, scored without review.
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

// GameStatePayload never holds draft answers; they stay in the client's localStorage.
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
	Letters            []string `json:"letters"`
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
	BuzzedBy      string         `json:"buzzedBy"`
	// EndReason is how the round ended: "timeout", "host", "buzz" or "finished" (sprint done).
	EndReason string `json:"endReason"`
	// Ready lists the voters done with this category; Voters all who may vote.
	Ready  []string `json:"ready"`
	Voters []string `json:"voters"`
}

type ScoreEntry struct {
	PlayerID    string `json:"playerId"`
	RoundPoints int    `json:"roundPoints"`
	TotalPoints int    `json:"totalPoints"`
	// Points lists the round's scoring answers in slot order.
	Points []int `json:"points,omitempty"`
	// Buzz is the first-buzz bonus, Combo the combo bonus on top of the round.
	Buzz  int `json:"buzz,omitempty"`
	Combo int `json:"combo,omitempty"`
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
	// Reason is set only when IsGameOver: "AlphabetFinished" | "HostEnded".
	Reason string `json:"reason,omitempty"`
}

type CommentatorPlayer struct {
	PlayerID          string   `json:"playerId"`
	FilledCategoryIDs []string `json:"filledCategoryIds"`
	Complete          bool     `json:"complete"`
}

type CommentatorStatePayload struct {
	RoundID string              `json:"roundId"`
	Players []CommentatorPlayer `json:"players"`
}

type CommentatorUpdatePayload struct {
	RoundID string            `json:"roundId"`
	Player  CommentatorPlayer `json:"player"`
}
