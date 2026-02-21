package model

import "time"

// MercuryConfig stores per-user Mercury agent configuration.
type MercuryConfig struct {
	ID                string    `json:"id"`
	UserID            string    `json:"userId"`
	TenantID          *string   `json:"tenantId,omitempty"`
	Name              string    `json:"name"`
	VoiceID           string    `json:"voiceId"`
	Greeting          string    `json:"greeting"`
	PersonalityPrompt *string   `json:"personalityPrompt"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

// DefaultMercuryConfig returns the default config when none exists for a user.
func DefaultMercuryConfig() MercuryConfig {
	return MercuryConfig{
		Name:     "Mercury",
		VoiceID:  "Ashley",
		Greeting: "Hello, I'm Mercury. How can I help you today?",
	}
}
