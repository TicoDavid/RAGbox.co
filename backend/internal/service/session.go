package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// SessionRepo defines persistence operations for learning sessions.
type SessionRepo interface {
	Create(ctx context.Context, session *model.LearningSession) error
	GetByID(ctx context.Context, id string) (*model.LearningSession, error)
	GetActive(ctx context.Context, userID string) (*model.LearningSession, error)
	Update(ctx context.Context, session *model.LearningSession) error
}

// SessionService manages learning sessions across queries.
type SessionService struct {
	repo SessionRepo
}

// NewSessionService creates a SessionService.
func NewSessionService(repo SessionRepo) *SessionService {
	return &SessionService{repo: repo}
}

// GetOrCreateActive returns the active session for a user, creating one if none exists.
func (s *SessionService) GetOrCreateActive(ctx context.Context, userID, vaultID string) (*model.LearningSession, error) {
	active, err := s.repo.GetActive(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("session.GetOrCreateActive: %w", err)
	}
	if active != nil {
		return active, nil
	}

	session := &model.LearningSession{
		UserID:           userID,
		VaultID:          vaultID,
		Status:           model.SessionStatusActive,
		TopicsCovered:    json.RawMessage(`[]`),
		DocumentsQueried: json.RawMessage(`[]`),
		QueryCount:       0,
		TotalDurationMs:  0,
	}

	if err := s.repo.Create(ctx, session); err != nil {
		return nil, fmt.Errorf("session.GetOrCreateActive: create: %w", err)
	}

	slog.Info("learning session created", "user_id", userID, "session_id", session.ID)
	return session, nil
}

// RecordQuery updates the active session with data from a completed query.
func (s *SessionService) RecordQuery(ctx context.Context, userID, query string, documentIDs []string, durationMs int64) error {
	active, err := s.repo.GetActive(ctx, userID)
	if err != nil {
		return fmt.Errorf("session.RecordQuery: get active: %w", err)
	}
	if active == nil {
		slog.Warn("no active session for query recording", "user_id", userID)
		return nil
	}

	// Increment query count
	active.QueryCount++
	active.TotalDurationMs += durationMs

	// Append topics (deduplicated)
	topics := extractTopicHints(query)
	existingTopics := decodeStringSlice(active.TopicsCovered)
	existingTopics = appendUnique(existingTopics, topics)
	active.TopicsCovered, _ = json.Marshal(existingTopics)

	// Append document IDs (deduplicated)
	existingDocs := decodeStringSlice(active.DocumentsQueried)
	existingDocs = appendUnique(existingDocs, documentIDs)
	active.DocumentsQueried, _ = json.Marshal(existingDocs)

	if err := s.repo.Update(ctx, active); err != nil {
		return fmt.Errorf("session.RecordQuery: update: %w", err)
	}

	return nil
}

// CompleteSession marks the active session as completed.
func (s *SessionService) CompleteSession(ctx context.Context, userID string) error {
	active, err := s.repo.GetActive(ctx, userID)
	if err != nil {
		return fmt.Errorf("session.CompleteSession: %w", err)
	}
	if active == nil {
		return nil
	}

	active.Status = model.SessionStatusCompleted
	if err := s.repo.Update(ctx, active); err != nil {
		return fmt.Errorf("session.CompleteSession: update: %w", err)
	}

	slog.Info("learning session completed",
		"user_id", userID,
		"session_id", active.ID,
		"query_count", active.QueryCount,
		"duration_ms", active.TotalDurationMs,
	)
	return nil
}

// decodeStringSlice unmarshals a JSON array of strings.
func decodeStringSlice(raw json.RawMessage) []string {
	var result []string
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil
	}
	return result
}

// appendUnique appends items to a slice, skipping duplicates.
func appendUnique(existing, items []string) []string {
	seen := make(map[string]bool, len(existing))
	for _, s := range existing {
		seen[s] = true
	}
	for _, s := range items {
		if !seen[s] {
			existing = append(existing, s)
			seen[s] = true
		}
	}
	return existing
}
