package model

import (
	"encoding/json"
	"time"
)

// MercuryPersona represents a tenant's configured AI persona.
// Column names match the Prisma-managed mercury_personas table.
type MercuryPersona struct {
	ID                   string          `json:"id"`
	TenantID             string          `json:"tenantId"`
	FirstName            string          `json:"firstName"`
	LastName             string          `json:"lastName"`
	Title                *string         `json:"title,omitempty"`
	PersonalityPrompt    string          `json:"personalityPrompt"`
	VoiceID              *string         `json:"voiceId,omitempty"`
	SilenceHighThreshold float64         `json:"silenceHighThreshold"`
	SilenceMedThreshold  float64         `json:"silenceMedThreshold"`
	ChannelConfig        json.RawMessage `json:"channelConfig,omitempty"`
	Greeting             *string         `json:"greeting,omitempty"`
	SignatureBlock       *string         `json:"signatureBlock,omitempty"`
	AvatarURL            *string         `json:"avatarUrl,omitempty"`
	IsActive             bool            `json:"isActive"`
	EmailEnabled         bool            `json:"emailEnabled"`
	EmailAddress         *string         `json:"emailAddress,omitempty"`
	CreatedAt            time.Time       `json:"createdAt"`
	UpdatedAt            time.Time       `json:"updatedAt"`
}

// FullName returns "FirstName LastName".
func (p *MercuryPersona) FullName() string {
	if p.LastName == "" {
		return p.FirstName
	}
	return p.FirstName + " " + p.LastName
}
