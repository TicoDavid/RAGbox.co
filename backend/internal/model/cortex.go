package model

import (
	"time"

	pgvector "github.com/pgvector/pgvector-go"
)

// CortexEntry represents a working memory entry (conversation context or instruction).
type CortexEntry struct {
	ID              string          `json:"id"`
	TenantID        string          `json:"tenantId"`
	Content         string          `json:"content"`
	Embedding       pgvector.Vector `json:"-"`
	SourceChannel   string          `json:"sourceChannel"`
	SourceMessageID *string         `json:"sourceMessageId,omitempty"`
	CapturedAt      time.Time       `json:"capturedAt"`
	Topic           *string         `json:"topic,omitempty"`
	IsInstruction   bool            `json:"isInstruction"`
	AutoSummary     *string         `json:"autoSummary,omitempty"`
	ExpiresAt       *time.Time      `json:"expiresAt,omitempty"`
}
