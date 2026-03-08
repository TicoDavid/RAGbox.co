package model

import "time"

// InsightType enumerates the categories of proactive insights.
type InsightType string

const (
	InsightDeadline InsightType = "deadline"
	InsightExpiring InsightType = "expiring"
	InsightAnomaly  InsightType = "anomaly"
	InsightTrend    InsightType = "trend"
	InsightReminder InsightType = "reminder"
)

// ProactiveInsight represents a scanner-detected time-sensitive finding from the vault.
type ProactiveInsight struct {
	ID             string      `json:"id"`
	UserID         string      `json:"userId"`
	TenantID       string      `json:"tenantId"`
	DocumentID     *string     `json:"documentId,omitempty"`
	InsightType    InsightType `json:"insightType"`
	Title          string      `json:"title"`
	Summary        string      `json:"summary"`
	SourceChunkID  *string     `json:"sourceChunkId,omitempty"`
	RelevanceScore float64     `json:"relevanceScore"`
	ExpiresAt      *time.Time  `json:"expiresAt,omitempty"`
	Acknowledged   bool        `json:"acknowledged"`
	CreatedAt      time.Time   `json:"createdAt"`
	UpdatedAt      time.Time   `json:"updatedAt"`
}
