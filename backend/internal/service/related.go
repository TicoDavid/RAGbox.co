package service

import (
	"context"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// RelatedDocument is a document with its cosine similarity to a source document.
type RelatedDocument struct {
	Document   model.Document `json:"document"`
	Similarity float64        `json:"similarity"`
}

// RelatedDocSearcher finds documents similar to a given document.
type RelatedDocSearcher interface {
	FindRelatedDocuments(ctx context.Context, documentID string, userID string, limit int) ([]RelatedDocument, error)
}
