package service

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// mockSessionRepo is a mock implementation of SessionRepo.
type mockSessionRepo struct {
	sessions []*model.LearningSession
	active   *model.LearningSession
}

func (m *mockSessionRepo) Create(ctx context.Context, session *model.LearningSession) error {
	session.ID = "session-" + session.UserID
	m.sessions = append(m.sessions, session)
	m.active = session
	return nil
}

func (m *mockSessionRepo) GetByID(ctx context.Context, id string) (*model.LearningSession, error) {
	for _, s := range m.sessions {
		if s.ID == id {
			return s, nil
		}
	}
	return nil, nil
}

func (m *mockSessionRepo) GetActive(ctx context.Context, userID string) (*model.LearningSession, error) {
	if m.active != nil && m.active.Status == model.SessionStatusActive {
		return m.active, nil
	}
	return nil, nil
}

func (m *mockSessionRepo) Update(ctx context.Context, session *model.LearningSession) error {
	m.active = session
	return nil
}

func TestSessionService_GetOrCreateActive_CreatesNew(t *testing.T) {
	repo := &mockSessionRepo{}
	svc := NewSessionService(repo)

	session, err := svc.GetOrCreateActive(context.Background(), "user-1", "vault-1")
	if err != nil {
		t.Fatalf("GetOrCreateActive() error: %v", err)
	}

	if session.ID == "" {
		t.Error("session ID should not be empty")
	}
	if session.UserID != "user-1" {
		t.Errorf("UserID = %q, want %q", session.UserID, "user-1")
	}
	if session.VaultID != "vault-1" {
		t.Errorf("VaultID = %q, want %q", session.VaultID, "vault-1")
	}
	if session.Status != model.SessionStatusActive {
		t.Errorf("Status = %q, want %q", session.Status, model.SessionStatusActive)
	}
	if session.QueryCount != 0 {
		t.Errorf("QueryCount = %d, want 0", session.QueryCount)
	}
}

func TestSessionService_GetOrCreateActive_ReturnsExisting(t *testing.T) {
	existing := &model.LearningSession{
		ID:               "existing-session",
		UserID:           "user-1",
		VaultID:          "vault-1",
		Status:           model.SessionStatusActive,
		TopicsCovered:    json.RawMessage(`["compliance"]`),
		DocumentsQueried: json.RawMessage(`["doc-1"]`),
		QueryCount:       5,
	}
	repo := &mockSessionRepo{active: existing}
	svc := NewSessionService(repo)

	session, err := svc.GetOrCreateActive(context.Background(), "user-1", "vault-1")
	if err != nil {
		t.Fatalf("GetOrCreateActive() error: %v", err)
	}

	if session.ID != "existing-session" {
		t.Errorf("should return existing session, got ID = %q", session.ID)
	}
	if session.QueryCount != 5 {
		t.Errorf("QueryCount = %d, want 5", session.QueryCount)
	}
}

func TestSessionService_RecordQuery(t *testing.T) {
	existing := &model.LearningSession{
		ID:               "session-1",
		UserID:           "user-1",
		VaultID:          "vault-1",
		Status:           model.SessionStatusActive,
		TopicsCovered:    json.RawMessage(`["existing"]`),
		DocumentsQueried: json.RawMessage(`["doc-1"]`),
		QueryCount:       2,
		TotalDurationMs:  1000,
	}
	repo := &mockSessionRepo{active: existing}
	svc := NewSessionService(repo)

	err := svc.RecordQuery(context.Background(), "user-1", "What about compliance regulations?", []string{"doc-1", "doc-2"}, 500, "openrouter", "openai/gpt-4o")
	if err != nil {
		t.Fatalf("RecordQuery() error: %v", err)
	}

	if existing.QueryCount != 3 {
		t.Errorf("QueryCount = %d, want 3", existing.QueryCount)
	}
	if existing.TotalDurationMs != 1500 {
		t.Errorf("TotalDurationMs = %d, want 1500", existing.TotalDurationMs)
	}

	// Check provider/model recorded
	if existing.LastProvider != "openrouter" {
		t.Errorf("LastProvider = %q, want %q", existing.LastProvider, "openrouter")
	}
	if existing.LastModelUsed != "openai/gpt-4o" {
		t.Errorf("LastModelUsed = %q, want %q", existing.LastModelUsed, "openai/gpt-4o")
	}

	// Check topics were appended (deduplicated)
	var topics []string
	json.Unmarshal(existing.TopicsCovered, &topics)
	if len(topics) < 2 {
		t.Errorf("expected at least 2 topics, got %d: %v", len(topics), topics)
	}

	// Check documents were appended (doc-1 deduped, doc-2 added)
	var docs []string
	json.Unmarshal(existing.DocumentsQueried, &docs)
	if len(docs) != 2 {
		t.Errorf("expected 2 documents, got %d: %v", len(docs), docs)
	}
}

func TestSessionService_RecordQuery_NoActiveSession(t *testing.T) {
	repo := &mockSessionRepo{}
	svc := NewSessionService(repo)

	// Should not error when no active session exists
	err := svc.RecordQuery(context.Background(), "user-1", "test query", []string{"doc-1"}, 100, "aegis", "gemini-1.5-pro")
	if err != nil {
		t.Fatalf("RecordQuery() should not error with no active session: %v", err)
	}
}

func TestSessionService_CompleteSession(t *testing.T) {
	existing := &model.LearningSession{
		ID:               "session-1",
		UserID:           "user-1",
		VaultID:          "vault-1",
		Status:           model.SessionStatusActive,
		TopicsCovered:    json.RawMessage(`[]`),
		DocumentsQueried: json.RawMessage(`[]`),
		QueryCount:       10,
	}
	repo := &mockSessionRepo{active: existing}
	svc := NewSessionService(repo)

	err := svc.CompleteSession(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("CompleteSession() error: %v", err)
	}

	if existing.Status != model.SessionStatusCompleted {
		t.Errorf("Status = %q, want %q", existing.Status, model.SessionStatusCompleted)
	}
}

func TestSessionService_CompleteSession_NoActive(t *testing.T) {
	repo := &mockSessionRepo{}
	svc := NewSessionService(repo)

	// Should not error when no active session
	err := svc.CompleteSession(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("CompleteSession() should not error with no active session: %v", err)
	}
}

func TestAppendUnique(t *testing.T) {
	existing := []string{"a", "b", "c"}
	items := []string{"b", "c", "d", "e"}
	result := appendUnique(existing, items)

	if len(result) != 5 {
		t.Errorf("appendUnique: got %d items, want 5: %v", len(result), result)
	}
}

func TestDecodeStringSlice(t *testing.T) {
	raw := json.RawMessage(`["hello","world"]`)
	result := decodeStringSlice(raw)
	if len(result) != 2 {
		t.Errorf("decodeStringSlice: got %d items, want 2", len(result))
	}

	// Invalid JSON returns nil
	result = decodeStringSlice(json.RawMessage(`invalid`))
	if result != nil {
		t.Errorf("decodeStringSlice with invalid JSON should return nil, got %v", result)
	}
}
