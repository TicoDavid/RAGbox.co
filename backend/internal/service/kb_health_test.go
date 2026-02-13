package service

import (
	"context"
	"testing"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// mockKBHealthRepo is a mock implementation of KBHealthRepo.
type mockKBHealthRepo struct {
	checks []model.KBHealthCheck
}

func (m *mockKBHealthRepo) InsertCheck(ctx context.Context, check *model.KBHealthCheck) error {
	check.ID = "check-" + check.CheckType
	m.checks = append(m.checks, *check)
	return nil
}

func (m *mockKBHealthRepo) LatestByVault(ctx context.Context, vaultID string, limit int) ([]model.KBHealthCheck, error) {
	return m.checks, nil
}

// mockDocumentLister is a mock implementation of DocumentLister.
type mockDocumentLister struct {
	docs []model.Document
}

func (m *mockDocumentLister) ListByVault(ctx context.Context, vaultID string) ([]model.Document, error) {
	return m.docs, nil
}

func TestKBHealthService_RunFreshnessCheck_AllFresh(t *testing.T) {
	now := time.Now().UTC()
	lister := &mockDocumentLister{
		docs: []model.Document{
			{ID: "d1", OriginalName: "doc1.pdf", UpdatedAt: now.AddDate(0, 0, -10)},
			{ID: "d2", OriginalName: "doc2.pdf", UpdatedAt: now.AddDate(0, 0, -5)},
		},
	}
	repo := &mockKBHealthRepo{}
	svc := NewKBHealthService(repo, lister)

	check, err := svc.RunFreshnessCheck(context.Background(), "vault-1")
	if err != nil {
		t.Fatalf("RunFreshnessCheck() error: %v", err)
	}

	if check.Status != model.HealthStatusPassed {
		t.Errorf("Status = %q, want %q", check.Status, model.HealthStatusPassed)
	}
	if check.CheckType != string(model.HealthCheckFreshness) {
		t.Errorf("CheckType = %q, want %q", check.CheckType, model.HealthCheckFreshness)
	}
}

func TestKBHealthService_RunFreshnessCheck_SomeStale(t *testing.T) {
	now := time.Now().UTC()
	lister := &mockDocumentLister{
		docs: []model.Document{
			{ID: "d1", OriginalName: "doc1.pdf", UpdatedAt: now.AddDate(0, 0, -10)},
			{ID: "d2", OriginalName: "doc2.pdf", UpdatedAt: now.AddDate(0, 0, -10)},
			{ID: "d3", OriginalName: "doc3.pdf", UpdatedAt: now.AddDate(0, 0, -10)},
			{ID: "d4", OriginalName: "stale.pdf", UpdatedAt: now.AddDate(0, 0, -100)},
		},
	}
	repo := &mockKBHealthRepo{}
	svc := NewKBHealthService(repo, lister)

	check, err := svc.RunFreshnessCheck(context.Background(), "vault-1")
	if err != nil {
		t.Fatalf("RunFreshnessCheck() error: %v", err)
	}

	if check.Status != model.HealthStatusWarning {
		t.Errorf("Status = %q, want %q (1 of 4 = 25%% stale)", check.Status, model.HealthStatusWarning)
	}
}

func TestKBHealthService_RunFreshnessCheck_MostlyStale(t *testing.T) {
	now := time.Now().UTC()
	lister := &mockDocumentLister{
		docs: []model.Document{
			{ID: "d1", OriginalName: "fresh.pdf", UpdatedAt: now.AddDate(0, 0, -10)},
			{ID: "d2", OriginalName: "stale1.pdf", UpdatedAt: now.AddDate(0, 0, -100)},
			{ID: "d3", OriginalName: "stale2.pdf", UpdatedAt: now.AddDate(0, 0, -200)},
		},
	}
	repo := &mockKBHealthRepo{}
	svc := NewKBHealthService(repo, lister)

	check, err := svc.RunFreshnessCheck(context.Background(), "vault-1")
	if err != nil {
		t.Fatalf("RunFreshnessCheck() error: %v", err)
	}

	if check.Status != model.HealthStatusFailed {
		t.Errorf("Status = %q, want %q (2 of 3 = 67%% stale)", check.Status, model.HealthStatusFailed)
	}
}

func TestKBHealthService_RunCoverageCheck_AllCovered(t *testing.T) {
	lister := &mockDocumentLister{
		docs: []model.Document{
			{ID: "d1", OriginalName: "doc1.pdf", ChunkCount: 5, IndexStatus: model.IndexIndexed},
			{ID: "d2", OriginalName: "doc2.pdf", ChunkCount: 3, IndexStatus: model.IndexIndexed},
		},
	}
	repo := &mockKBHealthRepo{}
	svc := NewKBHealthService(repo, lister)

	check, err := svc.RunCoverageCheck(context.Background(), "vault-1")
	if err != nil {
		t.Fatalf("RunCoverageCheck() error: %v", err)
	}

	if check.Status != model.HealthStatusPassed {
		t.Errorf("Status = %q, want %q", check.Status, model.HealthStatusPassed)
	}
}

func TestKBHealthService_RunCoverageCheck_SomeUncovered(t *testing.T) {
	lister := &mockDocumentLister{
		docs: []model.Document{
			{ID: "d1", OriginalName: "doc1.pdf", ChunkCount: 5, IndexStatus: model.IndexIndexed},
			{ID: "d2", OriginalName: "doc2.pdf", ChunkCount: 3, IndexStatus: model.IndexIndexed},
			{ID: "d3", OriginalName: "doc3.pdf", ChunkCount: 2, IndexStatus: model.IndexIndexed},
			{ID: "d4", OriginalName: "noindex.pdf", ChunkCount: 0, IndexStatus: model.IndexPending},
		},
	}
	repo := &mockKBHealthRepo{}
	svc := NewKBHealthService(repo, lister)

	check, err := svc.RunCoverageCheck(context.Background(), "vault-1")
	if err != nil {
		t.Fatalf("RunCoverageCheck() error: %v", err)
	}

	if check.Status != model.HealthStatusWarning {
		t.Errorf("Status = %q, want %q", check.Status, model.HealthStatusWarning)
	}
}

func TestKBHealthService_RunCoverageCheck_MostlyUncovered(t *testing.T) {
	lister := &mockDocumentLister{
		docs: []model.Document{
			{ID: "d1", OriginalName: "good.pdf", ChunkCount: 5, IndexStatus: model.IndexIndexed},
			{ID: "d2", OriginalName: "bad1.pdf", ChunkCount: 0, IndexStatus: model.IndexPending},
			{ID: "d3", OriginalName: "bad2.pdf", ChunkCount: 0, IndexStatus: model.IndexFailed},
		},
	}
	repo := &mockKBHealthRepo{}
	svc := NewKBHealthService(repo, lister)

	check, err := svc.RunCoverageCheck(context.Background(), "vault-1")
	if err != nil {
		t.Fatalf("RunCoverageCheck() error: %v", err)
	}

	if check.Status != model.HealthStatusFailed {
		t.Errorf("Status = %q, want %q", check.Status, model.HealthStatusFailed)
	}
}

func TestKBHealthService_EmptyVault(t *testing.T) {
	lister := &mockDocumentLister{docs: nil}
	repo := &mockKBHealthRepo{}
	svc := NewKBHealthService(repo, lister)

	check, err := svc.RunFreshnessCheck(context.Background(), "vault-empty")
	if err != nil {
		t.Fatalf("RunFreshnessCheck() error: %v", err)
	}
	if check.Status != model.HealthStatusPassed {
		t.Errorf("empty vault freshness Status = %q, want %q", check.Status, model.HealthStatusPassed)
	}

	check, err = svc.RunCoverageCheck(context.Background(), "vault-empty")
	if err != nil {
		t.Fatalf("RunCoverageCheck() error: %v", err)
	}
	if check.Status != model.HealthStatusPassed {
		t.Errorf("empty vault coverage Status = %q, want %q", check.Status, model.HealthStatusPassed)
	}
}
