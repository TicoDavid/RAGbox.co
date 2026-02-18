package model

import (
	"encoding/json"
	"time"
)

// MercuryPersona represents a tenant's configured AI persona.
type MercuryPersona struct {
	ID               string          `json:"id"`
	TenantID         string          `json:"tenantId"`
	Name             string          `json:"name"`
	Title            string          `json:"title"`
	Organization     string          `json:"organization"`
	Personality      string          `json:"personality"`
	VoiceID          *string         `json:"voiceId,omitempty"`
	SilenceThreshold float64         `json:"silenceThreshold"`
	Channels         json.RawMessage `json:"channels,omitempty"`
	GreetingMessage  *string         `json:"greetingMessage,omitempty"`
	EmailSignature   *string         `json:"emailSignature,omitempty"`
	AvatarURL        *string         `json:"avatarUrl,omitempty"`
	EmailEnabled     bool            `json:"emailEnabled"`
	EmailAddress     *string         `json:"emailAddress,omitempty"`
	CreatedAt        time.Time       `json:"createdAt"`
	UpdatedAt        time.Time       `json:"updatedAt"`
}
