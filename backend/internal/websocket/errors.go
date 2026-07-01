package websocket

// ErrorCode is a machine-readable error identifier sent to the client
// (SRS 9.8 / 12.3.1). The human-readable message is for display only; the code
// drives client logic. Severity follows SRS 12.3: "info" | "warning" | "critical".
type ErrorCode string

const (
	// Auth & Session
	CodeInvalidSession  ErrorCode = "INVALID_SESSION"
	CodeSessionNotFound ErrorCode = "SESSION_NOT_FOUND"

	// Lobby
	CodeLobbyNotFound    ErrorCode = "LOBBY_NOT_FOUND"
	CodeInvalidLobbyCode ErrorCode = "INVALID_LOBBY_CODE"

	// Player
	CodeNameTooShort   ErrorCode = "NAME_TOO_SHORT"
	CodeNameTooLong    ErrorCode = "NAME_TOO_LONG"
	CodeNameNotUnique  ErrorCode = "NAME_NOT_UNIQUE"
	CodePlayerNotFound ErrorCode = "PLAYER_NOT_FOUND"

	// Game state
	CodeInvalidState       ErrorCode = "INVALID_STATE"
	CodeGameAlreadyRunning ErrorCode = "GAME_ALREADY_RUNNING"

	// Host
	CodeNotHost ErrorCode = "NOT_HOST"

	// Categories (SRS 12.3.1 has no dedicated code; kept explicit for the client)
	CodeCategoryNotFound ErrorCode = "CATEGORY_NOT_FOUND"
	CodeCategoryMinimum  ErrorCode = "CATEGORY_MINIMUM"

	// Answers
	CodeInvalidAnswerLength ErrorCode = "INVALID_ANSWER_LENGTH"
	CodeInvalidFirstLetter  ErrorCode = "INVALID_FIRST_LETTER"

	// Generic validation (malformed payload / out-of-range settings)
	CodeValidationError ErrorCode = "VALIDATION_ERROR"
)

// severityOf maps a code to its SRS 12.3 severity. Session errors are critical
// (the client must re-establish a session); everything else is a recoverable
// warning the user can react to.
func severityOf(code ErrorCode) string {
	switch code {
	case CodeInvalidSession, CodeSessionNotFound:
		return "critical"
	default:
		return "warning"
	}
}

type errorPayload struct {
	Code     ErrorCode `json:"code"`
	Message  string    `json:"message"`
	Severity string    `json:"severity"`
}
