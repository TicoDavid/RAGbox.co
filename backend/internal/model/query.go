package model

import "time"

type QueryOutcome string

const (
	QueryAnswered QueryOutcome = "Answered"
	QueryRefused  QueryOutcome = "Refused"
)

// Query represents a user's RAG query.
type Query struct {
	ID              string       `json:"id"`
	UserID          string       `json:"userId"`
	QueryText       string       `json:"queryText"`
	ConfidenceScore *float64     `json:"confidenceScore,omitempty"`
	Outcome         QueryOutcome `json:"outcome"`
	PrivilegeMode   bool         `json:"privilegeMode"`
	ChunksUsed      int          `json:"chunksUsed"`
	LatencyMs       *int         `json:"latencyMs,omitempty"`
	Model           *string      `json:"model,omitempty"`
	CreatedAt       time.Time    `json:"createdAt"`
}

// Answer represents a generated answer to a query.
type Answer struct {
	ID         string    `json:"id"`
	QueryID    string    `json:"queryId"`
	AnswerText string    `json:"answerText"`
	CreatedAt  time.Time `json:"createdAt"`
}

// Citation links an answer to a document chunk.
type Citation struct {
	ID             string  `json:"id"`
	AnswerID       string  `json:"answerId"`
	DocumentID     string  `json:"documentId"`
	ChunkID        *string `json:"chunkId,omitempty"`
	RelevanceScore float64 `json:"relevanceScore"`
	Excerpt        *string `json:"excerpt,omitempty"`
	CitationIndex  int     `json:"citationIndex"`
}
