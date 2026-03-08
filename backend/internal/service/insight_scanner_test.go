package service

// Sarah — EPIC-028 Phase 4, Task 6: Insight scanner tests

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// mockGenAI implements GenAIClient for testing.
type mockInsightGenAI struct {
	response string
	err      error
}

func (m *mockInsightGenAI) GenerateContent(_ context.Context, _, _ string) (string, error) {
	return m.response, m.err
}

// mockInsightRepo implements InsightRepository for testing.
type mockInsightRepoForScanner struct {
	created  []*model.ProactiveInsight
	existing bool
	err      error
}

func (m *mockInsightRepoForScanner) CreateInsight(_ context.Context, insight *model.ProactiveInsight) error {
	m.created = append(m.created, insight)
	return m.err
}

func (m *mockInsightRepoForScanner) GetActiveInsights(_ context.Context, _ string, limit int) ([]model.ProactiveInsight, error) {
	return nil, nil
}

func (m *mockInsightRepoForScanner) AcknowledgeInsight(_ context.Context, _ string) error {
	return nil
}

func (m *mockInsightRepoForScanner) DeleteExpiredInsights(_ context.Context) (int, error) {
	return 0, nil
}

func (m *mockInsightRepoForScanner) ExistsByHash(_ context.Context, _, _, _, _ string) (bool, error) {
	return m.existing, nil
}

// mockChunkScanner implements ChunkScanner for testing.
type mockChunkScanner struct {
	chunks []ScannableChunk
	err    error
}

func (m *mockChunkScanner) RecentChunksByUser(_ context.Context, _ string, _ int) ([]ScannableChunk, error) {
	return m.chunks, m.err
}

func TestInsightScanner_DeadlineDetected(t *testing.T) {
	insights := buildMockGeminiResponse([]rawInsight{
		{Type: "deadline", Title: "Contract due by March 15", Summary: "Section 3 deadline", RelevanceScore: 0.9},
	})
	scanner := NewInsightScannerService(
		&mockInsightGenAI{response: insights},
		&mockInsightRepoForScanner{},
		&mockChunkScanner{chunks: []ScannableChunk{
			{ChunkID: "c1", DocumentID: "d1", Content: "The contract is due by March 15, 2026."},
		}},
	)

	result, err := scanner.ScanVaultForInsights(context.Background(), "user1", "tenant1")
	if err != nil {
		t.Fatalf("ScanVaultForInsights error: %v", err)
	}
	if len(result) == 0 {
		t.Fatal("expected at least 1 insight for deadline pattern")
	}
	if result[0].InsightType != model.InsightDeadline {
		t.Errorf("expected deadline type, got %q", result[0].InsightType)
	}
}

func TestInsightScanner_ExpiringContractDetected(t *testing.T) {
	insights := buildMockGeminiResponse([]rawInsight{
		{Type: "expiring", Title: "Renewal date April 1", Summary: "Contract renewal approaching", RelevanceScore: 0.85},
	})
	scanner := NewInsightScannerService(
		&mockInsightGenAI{response: insights},
		&mockInsightRepoForScanner{},
		&mockChunkScanner{chunks: []ScannableChunk{
			{ChunkID: "c2", DocumentID: "d2", Content: "The renewal date is April 1, 2026."},
		}},
	)

	result, err := scanner.ScanVaultForInsights(context.Background(), "user1", "tenant1")
	if err != nil {
		t.Fatalf("ScanVaultForInsights error: %v", err)
	}
	if len(result) == 0 {
		t.Fatal("expected at least 1 insight for expiring pattern")
	}
	if result[0].InsightType != model.InsightExpiring {
		t.Errorf("expected expiring type, got %q", result[0].InsightType)
	}
}

func TestInsightScanner_ActionItemDetected(t *testing.T) {
	insights := buildMockGeminiResponse([]rawInsight{
		{Type: "reminder", Title: "Action required by Friday", Summary: "Response needed", RelevanceScore: 0.8},
	})
	scanner := NewInsightScannerService(
		&mockInsightGenAI{response: insights},
		&mockInsightRepoForScanner{},
		&mockChunkScanner{chunks: []ScannableChunk{
			{ChunkID: "c3", DocumentID: "d3", Content: "Action required by Friday. Please respond."},
		}},
	)

	result, err := scanner.ScanVaultForInsights(context.Background(), "user1", "tenant1")
	if err != nil {
		t.Fatalf("ScanVaultForInsights error: %v", err)
	}
	if len(result) == 0 {
		t.Fatal("expected at least 1 insight for action required pattern")
	}
}

func TestInsightScanner_NoTimeSensitiveContent(t *testing.T) {
	scanner := NewInsightScannerService(
		&mockInsightGenAI{response: "[]"},
		&mockInsightRepoForScanner{},
		&mockChunkScanner{chunks: []ScannableChunk{
			{ChunkID: "c4", DocumentID: "d4", Content: "The weather today is sunny and mild."},
		}},
	)

	result, err := scanner.ScanVaultForInsights(context.Background(), "user1", "tenant1")
	if err != nil {
		t.Fatalf("ScanVaultForInsights error: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("expected 0 insights for non-time-sensitive content, got %d", len(result))
	}
}

func TestInsightScanner_DuplicateDetection(t *testing.T) {
	insights := buildMockGeminiResponse([]rawInsight{
		{Type: "deadline", Title: "Contract due March 15", Summary: "Deadline", RelevanceScore: 0.9, DocumentID: "d1"},
	})
	repo := &mockInsightRepoForScanner{existing: true} // Simulate existing insight
	scanner := NewInsightScannerService(
		&mockInsightGenAI{response: insights},
		repo,
		&mockChunkScanner{chunks: []ScannableChunk{
			{ChunkID: "c1", DocumentID: "d1", Content: "The contract is due by March 15, 2026."},
		}},
	)

	result, err := scanner.ScanVaultForInsights(context.Background(), "user1", "tenant1")
	if err != nil {
		t.Fatalf("ScanVaultForInsights error: %v", err)
	}
	if len(result) != 0 {
		t.Error("expected 0 insights when duplicate exists")
	}
}

func TestInsightScanner_RelevanceScoreBounded(t *testing.T) {
	insights := buildMockGeminiResponse([]rawInsight{
		{Type: "deadline", Title: "Test", Summary: "Test", RelevanceScore: 0.75},
	})
	repo := &mockInsightRepoForScanner{}
	scanner := NewInsightScannerService(
		&mockInsightGenAI{response: insights},
		repo,
		&mockChunkScanner{chunks: []ScannableChunk{
			{ChunkID: "c1", DocumentID: "d1", Content: "Due by next week, action required immediately."},
		}},
	)

	result, err := scanner.ScanVaultForInsights(context.Background(), "user1", "tenant1")
	if err != nil {
		t.Fatalf("ScanVaultForInsights error: %v", err)
	}
	for _, ins := range result {
		if ins.RelevanceScore < 0 || ins.RelevanceScore > 1 {
			t.Errorf("relevance score %f out of [0, 1] bounds", ins.RelevanceScore)
		}
	}
}

func TestInsightScanner_EmptyVault(t *testing.T) {
	scanner := NewInsightScannerService(
		&mockInsightGenAI{},
		&mockInsightRepoForScanner{},
		&mockChunkScanner{chunks: nil},
	)

	result, err := scanner.ScanVaultForInsights(context.Background(), "user1", "tenant1")
	if err != nil {
		t.Fatalf("ScanVaultForInsights error: %v", err)
	}
	if result != nil {
		t.Errorf("expected nil for empty vault, got %v", result)
	}
}

func TestInsightScanner_GetActiveInsightsDelegates(t *testing.T) {
	repo := &mockInsightRepoForScanner{}
	scanner := NewInsightScannerService(nil, repo, nil)

	_, err := scanner.GetActiveInsights(context.Background(), "user1", 5)
	if err != nil {
		t.Fatalf("GetActiveInsights error: %v", err)
	}
}

func TestInsightScanner_AcknowledgeDelegates(t *testing.T) {
	repo := &mockInsightRepoForScanner{}
	scanner := NewInsightScannerService(nil, repo, nil)

	if err := scanner.AcknowledgeInsight(context.Background(), "insight-1"); err != nil {
		t.Fatalf("AcknowledgeInsight error: %v", err)
	}
}

// buildMockGeminiResponse serializes insights as JSON the way Gemini would return them.
func buildMockGeminiResponse(insights []rawInsight) string {
	b, err := json.Marshal(insights)
	if err != nil {
		panic(fmt.Sprintf("failed to marshal mock insights: %v", err))
	}
	return string(b)
}
