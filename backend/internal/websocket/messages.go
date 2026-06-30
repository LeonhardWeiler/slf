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
}
