package service

import (
	"context"
	"testing"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// mockContentGapRepo is a mock implementation of ContentGapRepo.
type mockContentGapRepo struct {
	inserted []model.ContentGap
	gaps     []model.ContentGap
	count    int
}

func (m *mockContentGapRepo) Insert(ctx context.Context, gap *model.ContentGap) error {
	gap.ID = "gap-" + gap.UserID
	m.inserted = append(m.inserted, *gap)
	return nil
}

func (m *mockContentGapRepo) ListByUser(ctx context.Context, userID string, status string, limit int) ([]model.ContentGap, error) {
	return m.gaps, nil
}

func (m *mockContentGapRepo) UpdateStatus(ctx context.Context, id string, status model.GapStatus) error {
	return nil
}

func (m *mockContentGapRepo) CountByUser(ctx context.Context, userID string) (int, error) {
	return m.count, nil
}

func TestContentGapService_LogGap(t *testing.T) {
	repo := &mockContentGapRepo{}
	svc := NewContentGapService(repo)

	err := svc.LogGap(context.Background(), "user-1", "What are the compliance requirements for HIPAA?", 0.42)
	if err != nil {
		t.Fatalf("LogGap() error: %v", err)
	}

	if len(repo.inserted) != 1 {
		t.Fatalf("expected 1 inserted gap, got %d", len(repo.inserted))
	}

	gap := repo.inserted[0]
	if gap.UserID != "user-1" {
		t.Errorf("UserID = %q, want %q", gap.UserID, "user-1")
	}
	if gap.ConfidenceScore != 0.42 {
		t.Errorf("ConfidenceScore = %f, want 0.42", gap.ConfidenceScore)
	}
	if gap.Status != model.GapStatusOpen {
		t.Errorf("Status = %q, want %q", gap.Status, model.GapStatusOpen)
	}
	if len(gap.SuggestedTopics) == 0 {
		t.Error("SuggestedTopics should not be empty")
	}
}

func TestContentGapService_GetGapCount(t *testing.T) {
	repo := &mockContentGapRepo{count: 5}
	svc := NewContentGapService(repo)

	count, err := svc.GetGapCount(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("GetGapCount() error: %v", err)
	}
	if count != 5 {
		t.Errorf("count = %d, want 5", count)
	}
}

func TestExtractTopicHints(t *testing.T) {
	tests := []struct {
		name  string
		query string
		want  int // minimum number of topics expected
	}{
		{
			name:  "normal query",
			query: "What are the compliance requirements for HIPAA regulations?",
			want:  2,
		},
		{
			name:  "short words only",
			query: "is it ok to do",
			want:  0,
		},
		{
			name:  "empty query",
			query: "",
			want:  0,
		},
		{
			name:  "capped at 5",
			query: "compliance requirements HIPAA regulations healthcare privacy security breach notification enforcement penalties",
			want:  5,
		},
		{
			name:  "stop words filtered",
			query: "what about the compliance with these regulations",
			want:  1, // "compliance" and "regulations"
		},
		{
			name:  "duplicates removed",
			query: "compliance compliance compliance requirements requirements",
			want:  2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractTopicHints(tt.query)
			if len(got) < tt.want {
				t.Errorf("extractTopicHints(%q) = %v (len %d), want at least %d", tt.query, got, len(got), tt.want)
			}
			if len(got) > 5 {
				t.Errorf("extractTopicHints(%q) returned %d topics, max should be 5", tt.query, len(got))
			}
		})
	}
}

func TestExtractTopicHints_NoDuplicates(t *testing.T) {
	topics := extractTopicHints("report report report analysis analysis")
	seen := map[string]bool{}
	for _, topic := range topics {
		if seen[topic] {
			t.Errorf("duplicate topic: %q", topic)
		}
		seen[topic] = true
	}
}

func TestTruncateStr(t *testing.T) {
	if got := truncateStr("hello", 10); got != "hello" {
		t.Errorf("truncateStr short = %q, want %q", got, "hello")
	}
	if got := truncateStr("hello world", 5); got != "hello" {
		t.Errorf("truncateStr long = %q, want %q", got, "hello")
	}
}
