package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	pgvector "github.com/pgvector/pgvector-go"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// instructionPatterns are phrases that indicate a user wants Mercury to remember something.
var instructionPatterns = []string{
	"remember", "always", "never forget", "don't forget", "make sure to",
	"from now on", "going forward", "keep in mind",
}

// CortexStore abstracts cortex persistence for testability.
type CortexStore interface {
	Insert(ctx context.Context, entry *model.CortexEntry) error
	Search(ctx context.Context, tenantID string, queryEmbedding pgvector.Vector, limit int) ([]model.CortexEntry, error)
	GetInstructions(ctx context.Context, tenantID string) ([]model.CortexEntry, error)
	DeleteExpired(ctx context.Context) (int64, error)
}

// CortexEmbedder embeds text for cortex storage and retrieval.
type CortexEmbedder interface {
	Embed(ctx context.Context, texts []string) ([][]float32, error)
}

// CortexService manages working memory — conversation capture and retrieval.
type CortexService struct {
	repo     CortexStore
	embedder CortexEmbedder
}

// NewCortexService creates a CortexService.
func NewCortexService(repo CortexStore, embedder CortexEmbedder) *CortexService {
	return &CortexService{
		repo:     repo,
		embedder: embedder,
	}
}

// Ingest stores a piece of context or instruction in working memory.
// Instructions (detected by keyword patterns or explicit flag) never expire.
// Regular context expires after 90 days.
func (s *CortexService) Ingest(ctx context.Context, tenantID, content, sourceChannel string, sourceMessageID *string, isInstruction bool) error {
	if content == "" {
		return nil
	}

	// Auto-detect instructions from content
	if !isInstruction {
		lower := strings.ToLower(content)
		for _, pattern := range instructionPatterns {
			if strings.Contains(lower, pattern) {
				isInstruction = true
				break
			}
		}
	}

	// Embed the content
	vectors, err := s.embedder.Embed(ctx, []string{content})
	if err != nil {
		return fmt.Errorf("cortex.Ingest: embed: %w", err)
	}

	embedding := pgvector.NewVector(vectors[0])

	entry := &model.CortexEntry{
		TenantID:        tenantID,
		Content:         content,
		Embedding:       embedding,
		SourceChannel:   sourceChannel,
		SourceMessageID: sourceMessageID,
		CapturedAt:      time.Now().UTC(),
		IsInstruction:   isInstruction,
	}

	// Instructions never expire; regular context expires in 90 days
	if !isInstruction {
		expiry := time.Now().UTC().Add(90 * 24 * time.Hour)
		entry.ExpiresAt = &expiry
	}

	if err := s.repo.Insert(ctx, entry); err != nil {
		return fmt.Errorf("cortex.Ingest: insert: %w", err)
	}

	return nil
}

// Search finds relevant cortex entries for a query using recency-weighted semantic search.
func (s *CortexService) Search(ctx context.Context, tenantID, query string, limit int) ([]model.CortexEntry, error) {
	if limit <= 0 {
		limit = 3
	}

	vectors, err := s.embedder.Embed(ctx, []string{query})
	if err != nil {
		return nil, fmt.Errorf("cortex.Search: embed: %w", err)
	}

	embedding := pgvector.NewVector(vectors[0])

	entries, err := s.repo.Search(ctx, tenantID, embedding, limit)
	if err != nil {
		return nil, fmt.Errorf("cortex.Search: %w", err)
	}

	return entries, nil
}

// GetActiveInstructions returns all standing instructions for a tenant.
func (s *CortexService) GetActiveInstructions(ctx context.Context, tenantID string) ([]model.CortexEntry, error) {
	return s.repo.GetInstructions(ctx, tenantID)
}
