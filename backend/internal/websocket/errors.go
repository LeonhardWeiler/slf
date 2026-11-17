package websocket

// ErrorCode drives client logic; the message is for display only.
type ErrorCode string

const (
	CodeInvalidSession  ErrorCode = "INVALID_SESSION"
	CodeSessionNotFound ErrorCode = "SESSION_NOT_FOUND"

	CodeLobbyNotFound    ErrorCode = "LOBBY_NOT_FOUND"
	CodeInvalidLobbyCode ErrorCode = "INVALID_LOBBY_CODE"

	CodeNameTooShort   ErrorCode = "NAME_TOO_SHORT"
	CodeNameTooLong    ErrorCode = "NAME_TOO_LONG"
	CodeNameNotUnique  ErrorCode = "NAME_NOT_UNIQUE"
	CodePlayerNotFound ErrorCode = "PLAYER_NOT_FOUND"

	CodeInvalidState       ErrorCode = "INVALID_STATE"
	CodeGameAlreadyRunning ErrorCode = "GAME_ALREADY_RUNNING"

	CodeNotHost ErrorCode = "NOT_HOST"

	CodeCategoryNotFound ErrorCode = "CATEGORY_NOT_FOUND"

	CodeValidationError ErrorCode = "VALIDATION_ERROR"
)

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
