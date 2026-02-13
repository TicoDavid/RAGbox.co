package service

import (
	"context"
	"log/slog"
	"strings"
	"unicode"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// ContentGapRepo defines persistence operations for content gaps.
type ContentGapRepo interface {
	Insert(ctx context.Context, gap *model.ContentGap) error
	ListByUser(ctx context.Context, userID string, status string, limit int) ([]model.ContentGap, error)
	UpdateStatus(ctx context.Context, id string, status model.GapStatus) error
	CountByUser(ctx context.Context, userID string) (int, error)
}

// ContentGapService logs and manages content gaps detected by the Silence Protocol.
type ContentGapService struct {
	repo ContentGapRepo
}

// NewContentGapService creates a ContentGapService.
func NewContentGapService(repo ContentGapRepo) *ContentGapService {
	return &ContentGapService{repo: repo}
}

// LogGap records a content gap when the Silence Protocol fires.
func (s *ContentGapService) LogGap(ctx context.Context, userID, query string, confidence float64) error {
	topics := extractTopicHints(query)

	gap := &model.ContentGap{
		UserID:          userID,
		QueryText:       truncateStr(query, 2000),
		ConfidenceScore: confidence,
		SuggestedTopics: topics,
		Status:          model.GapStatusOpen,
	}

	if err := s.repo.Insert(ctx, gap); err != nil {
		slog.Error("failed to log content gap", "user_id", userID, "error", err)
		return err
	}

	slog.Info("content gap logged",
		"user_id", userID,
		"gap_id", gap.ID,
		"confidence", confidence,
		"topics", topics,
	)
	return nil
}

// GetOpenGaps returns open content gaps for a user.
func (s *ContentGapService) GetOpenGaps(ctx context.Context, userID string, limit int) ([]model.ContentGap, error) {
	return s.repo.ListByUser(ctx, userID, string(model.GapStatusOpen), limit)
}

// ListGaps returns content gaps for a user, optionally filtered by status.
func (s *ContentGapService) ListGaps(ctx context.Context, userID string, status string, limit int) ([]model.ContentGap, error) {
	return s.repo.ListByUser(ctx, userID, status, limit)
}

// DismissGap marks a content gap as dismissed.
func (s *ContentGapService) DismissGap(ctx context.Context, gapID string) error {
	return s.repo.UpdateStatus(ctx, gapID, model.GapStatusDismissed)
}

// AddressGap marks a content gap as addressed.
func (s *ContentGapService) AddressGap(ctx context.Context, gapID string) error {
	return s.repo.UpdateStatus(ctx, gapID, model.GapStatusAddressed)
}

// GetGapCount returns the number of open content gaps for a user.
func (s *ContentGapService) GetGapCount(ctx context.Context, userID string) (int, error) {
	return s.repo.CountByUser(ctx, userID)
}

// stopWords is a set of common English words to exclude from topic extraction.
var stopWords = map[string]bool{
	"the": true, "and": true, "for": true, "are": true, "but": true,
	"not": true, "you": true, "all": true, "can": true, "had": true,
	"her": true, "was": true, "one": true, "our": true, "out": true,
	"has": true, "have": true, "been": true, "from": true, "this": true,
	"that": true, "they": true, "with": true, "what": true, "when": true,
	"where": true, "which": true, "will": true, "how": true, "does": true,
	"about": true, "into": true, "than": true, "them": true, "then": true,
	"there": true, "these": true, "would": true, "could": true, "should": true,
	"their": true, "other": true, "some": true, "such": true, "also": true,
	"just": true, "more": true, "most": true, "very": true, "much": true,
	"many": true, "each": true, "only": true, "like": true, "over": true,
}

// extractTopicHints extracts topic hint words from a query string.
// It returns unique words >3 chars that are not stop words, capped at 5.
func extractTopicHints(query string) []string {
	words := strings.Fields(query)
	seen := map[string]bool{}
	var topics []string

	for _, w := range words {
		// Strip non-letter characters from edges
		cleaned := strings.TrimFunc(w, func(r rune) bool {
			return !unicode.IsLetter(r) && !unicode.IsDigit(r)
		})
		lower := strings.ToLower(cleaned)

		if len(lower) <= 3 {
			continue
		}
		if stopWords[lower] {
			continue
		}
		if seen[lower] {
			continue
		}

		seen[lower] = true
		topics = append(topics, lower)

		if len(topics) >= 5 {
			break
		}
	}
	return topics
}

// truncateStr returns the first n characters of s.
func truncateStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}
