package service

import (
	"context"
	"testing"
	"time"
)

// stubUsageRepo implements UsageRepository for testing.
type stubUsageRepo struct {
	usageMap map[string]int64
}

func newStubUsageRepo() *stubUsageRepo {
	return &stubUsageRepo{usageMap: make(map[string]int64)}
}

func (r *stubUsageRepo) Increment(_ context.Context, userID, metric string) error {
	key := userID + ":" + metric
	r.usageMap[key]++
	return nil
}

func (r *stubUsageRepo) GetUsage(_ context.Context, userID, metric string) (int64, error) {
	key := userID + ":" + metric
	return r.usageMap[key], nil
}

func (r *stubUsageRepo) GetAllUsage(_ context.Context, userID string) ([]UsageRecord, error) {
	var records []UsageRecord
	now := time.Now().UTC()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	periodEnd := periodStart.AddDate(0, 1, 0)

	for key, count := range r.usageMap {
		// Parse "userID:metric" — only return records for the requested user
		parts := splitKeyParts(key)
		if len(parts) == 2 && parts[0] == userID {
			records = append(records, UsageRecord{
				UserID:      userID,
				Metric:      parts[1],
				Count:       count,
				PeriodStart: periodStart,
				PeriodEnd:   periodEnd,
			})
		}
	}
	return records, nil
}

func splitKeyParts(key string) []string {
	for i, ch := range key {
		if ch == ':' {
			return []string{key[:i], key[i+1:]}
		}
	}
	return []string{key}
}

func TestUsageService_IncrementAndCheck(t *testing.T) {
	repo := newStubUsageRepo()
	svc := NewUsageService(repo)
	ctx := context.Background()

	// Before any usage — should be allowed
	allowed, count, limit, err := svc.CheckLimit(ctx, "user1", "aegis_queries", "sovereign")
	if err != nil {
		t.Fatalf("CheckLimit error: %v", err)
	}
	if !allowed {
		t.Fatal("expected allowed=true for empty usage")
	}
	if count != 0 {
		t.Fatalf("expected count=0, got %d", count)
	}
	if limit != 500 {
		t.Fatalf("expected limit=500 for sovereign, got %d", limit)
	}

	// Increment a few times
	for i := 0; i < 5; i++ {
		if err := svc.IncrementUsage(ctx, "user1", "aegis_queries"); err != nil {
			t.Fatalf("IncrementUsage error: %v", err)
		}
	}

	// Check again
	allowed, count, _, err = svc.CheckLimit(ctx, "user1", "aegis_queries", "sovereign")
	if err != nil {
		t.Fatalf("CheckLimit error: %v", err)
	}
	if !allowed {
		t.Fatal("expected allowed=true for 5/500")
	}
	if count != 5 {
		t.Fatalf("expected count=5, got %d", count)
	}
}

func TestUsageService_FreeTierLimit(t *testing.T) {
	repo := newStubUsageRepo()
	svc := NewUsageService(repo)
	ctx := context.Background()

	// Fill up free tier (25 queries)
	for i := 0; i < 25; i++ {
		svc.IncrementUsage(ctx, "user2", "aegis_queries")
	}

	allowed, count, limit, err := svc.CheckLimit(ctx, "user2", "aegis_queries", "free")
	if err != nil {
		t.Fatalf("CheckLimit error: %v", err)
	}
	if allowed {
		t.Fatal("expected allowed=false for 25/25")
	}
	if count != 25 {
		t.Fatalf("expected count=25, got %d", count)
	}
	if limit != 25 {
		t.Fatalf("expected limit=25, got %d", limit)
	}
}

func TestUsageService_UnlimitedTier(t *testing.T) {
	repo := newStubUsageRepo()
	svc := NewUsageService(repo)
	ctx := context.Background()

	// Syndicate has unlimited documents
	allowed, _, limit, err := svc.CheckLimit(ctx, "user3", "documents_stored", "syndicate")
	if err != nil {
		t.Fatalf("CheckLimit error: %v", err)
	}
	if !allowed {
		t.Fatal("expected allowed=true for unlimited tier")
	}
	if limit != -1 {
		t.Fatalf("expected limit=-1 for unlimited, got %d", limit)
	}
}

func TestUsageService_GetUsageReport(t *testing.T) {
	repo := newStubUsageRepo()
	svc := NewUsageService(repo)
	ctx := context.Background()

	// Add some usage
	for i := 0; i < 42; i++ {
		svc.IncrementUsage(ctx, "user4", "aegis_queries")
	}
	for i := 0; i < 3; i++ {
		svc.IncrementUsage(ctx, "user4", "documents_stored")
	}

	report, err := svc.GetUsageReport(ctx, "user4", "sovereign")
	if err != nil {
		t.Fatalf("GetUsageReport error: %v", err)
	}

	if report.Tier != "sovereign" {
		t.Fatalf("expected tier=sovereign, got %s", report.Tier)
	}

	aegis := report.Usage["aegis_queries"]
	if aegis.Used != 42 {
		t.Fatalf("expected aegis used=42, got %d", aegis.Used)
	}
	if aegis.Limit != 500 {
		t.Fatalf("expected aegis limit=500, got %d", aegis.Limit)
	}
	if aegis.Percent != 8 {
		t.Fatalf("expected aegis percent=8, got %d", aegis.Percent)
	}

	docs := report.Usage["documents_stored"]
	if docs.Used != 3 {
		t.Fatalf("expected docs used=3, got %d", docs.Used)
	}
}

func TestUsageService_UnknownTierFallsToFree(t *testing.T) {
	repo := newStubUsageRepo()
	svc := NewUsageService(repo)
	ctx := context.Background()

	report, err := svc.GetUsageReport(ctx, "user5", "unknown_tier")
	if err != nil {
		t.Fatalf("GetUsageReport error: %v", err)
	}
	if report.Tier != "free" {
		t.Fatalf("expected tier=free for unknown, got %s", report.Tier)
	}
}

func TestTierLimitMap_AllTiersDefined(t *testing.T) {
	expectedTiers := []string{"free", "sovereign", "mercury", "syndicate"}
	for _, tier := range expectedTiers {
		if _, ok := TierLimitMap[tier]; !ok {
			t.Fatalf("missing tier: %s", tier)
		}
	}
}
