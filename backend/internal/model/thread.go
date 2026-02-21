package model

import "time"

// MercuryThreadMessage represents a single message in a user's unified thread.
// All channels (dashboard, whatsapp, voice, sms, email, roam) write to this table.
type MercuryThreadMessage struct {
	ID               string    `json:"id"`
	ThreadID         string    `json:"threadId"`
	Role             string    `json:"role"`             // "user" | "assistant"
	Channel          string    `json:"channel"`          // "dashboard" | "whatsapp" | "voice" | "sms" | "email" | "roam"
	Content          string    `json:"content"`
	Confidence       *float64  `json:"confidence,omitempty"`
	ChannelMessageID *string   `json:"channelMessageId,omitempty"` // external message ID (e.g. Vonage message_uuid)
	Direction        string    `json:"direction"`                  // "inbound" | "outbound"
	CreatedAt        time.Time `json:"createdAt"`
}
