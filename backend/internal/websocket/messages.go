package websocket

import "encoding/json"

type InboundMessage struct {
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload"`
	SessionID string          `json:"sessionId"`
}

type OutboundMessage struct {
	Type    string `json:"type"`
	Payload any    `json:"payload"`
	// StateVersion is the lobby's monotonic version at send time (SRS 9.15.2).
	// 0 on connection-level messages that are not a lobby state snapshot.
	StateVersion int `json:"stateVersion"`
}
