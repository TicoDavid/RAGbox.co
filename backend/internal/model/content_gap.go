package model

import "time"

type GapStatus string

const (
	GapStatusOpen      GapStatus = "open"
	GapStatusAddressed GapStatus = "addressed"
	GapStatusDismissed GapStatus = "dismissed"
)

// ContentGap records a query where the Silence Protocol fired due to low confidence.
type ContentGap struct {
	ID              string    `json:"id"`
	UserID          string    `json:"userId"`
	QueryText       string    `json:"queryText"`
	ConfidenceScore float64   `json:"confidenceScore"`
	SuggestedTopics []string  `json:"suggestedTopics"`
	Status          GapStatus `json:"status"`
	AddressedAt     *time.Time `json:"addressedAt,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
}
