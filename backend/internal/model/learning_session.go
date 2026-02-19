package model

import (
	"encoding/json"
	"time"
)

type SessionStatus string

const (
	SessionStatusActive    SessionStatus = "active"
	SessionStatusPaused    SessionStatus = "paused"
	SessionStatusCompleted SessionStatus = "completed"
)

// LearningSession tracks a user's query session within a vault.
type LearningSession struct {
	ID               string          `json:"id"`
	UserID           string          `json:"userId"`
	VaultID          string          `json:"vaultId"`
	Status           SessionStatus   `json:"status"`
	TopicsCovered    json.RawMessage `json:"topicsCovered"`
	DocumentsQueried json.RawMessage `json:"documentsQueried"`
	QueryCount       int             `json:"queryCount"`
	TotalDurationMs  int64           `json:"totalDurationMs"`
	LastProvider     string          `json:"lastProvider"`
	LastModelUsed    string          `json:"lastModelUsed"`
	CreatedAt        time.Time       `json:"createdAt"`
	UpdatedAt        time.Time       `json:"updatedAt"`
}
