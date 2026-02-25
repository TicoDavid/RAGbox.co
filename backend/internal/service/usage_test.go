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

func (r *stubUsageRepo) IncrementBy(_ context.Context, userID, metric string, amount int64) error {
	key := userID + ":" + metric
	r.usageMap[key] += amount
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
	expectedTiers := []string{"free", "sovereign", "mercury", "syndicate", "starter", "professional", "enterprise"}
	for _, tier := range expectedTiers {
		if _, ok := TierLimitMap[tier]; !ok {
			t.Fatalf("missing tier: %s", tier)
		}
	}
}

// ── STORY-199: Token allocation enforcement tests ──────────────────────

func TestTokenBudget_StarterLimitEnforced(t *testing.T) {
	repo := newStubUsageRepo()
	svc := NewUsageService(repo)
	ctx := context.Background()

	// Starter tier has 2M token budget
	allowed, _, budget, err := svc.CheckTokenLimit(ctx, "tenant1", "starter")
	if err != nil {
		t.Fatalf("CheckTokenLimit error: %v", err)
	}
	if !allowed {
		t.Fatal("expected allowed=true with zero usage")
	}
	if budget != TokenBudgetStarter {
		t.Fatalf("expected budget=%d, got %d", TokenBudgetStarter, budget)
	}

	// Consume 1.9M tokens — still under budget
	if err := svc.IncrementTokenUsage(ctx, "tenant1", 1_900_000); err != nil {
		t.Fatalf("IncrementTokenUsage error: %v", err)
	}

	allowed, used, _, err := svc.CheckTokenLimit(ctx, "tenant1", "starter")
	if err != nil {
		t.Fatalf("CheckTokenLimit error: %v", err)
	}
	if !allowed {
		t.Fatal("expected allowed=true at 1.9M/2M")
	}
	if used != 1_900_000 {
		t.Fatalf("expected used=1900000, got %d", used)
	}

	// Consume another 200K — now at 2.1M, over budget
	if err := svc.IncrementTokenUsage(ctx, "tenant1", 200_000); err != nil {
		t.Fatalf("IncrementTokenUsage error: %v", err)
	}

	allowed, used, _, err = svc.CheckTokenLimit(ctx, "tenant1", "starter")
	if err != nil {
		t.Fatalf("CheckTokenLimit error: %v", err)
	}
	if allowed {
		t.Fatal("expected allowed=false at 2.1M/2M")
	}
	if used != 2_100_000 {
		t.Fatalf("expected used=2100000, got %d", used)
	}
}

func TestTokenBudget_ProfessionalLimit(t *testing.T) {
	repo := newStubUsageRepo()
	svc := NewUsageService(repo)
	ctx := context.Background()

	// Professional tier has 5M budget
	allowed, _, budget, err := svc.CheckTokenLimit(ctx, "tenant2", "professional")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if !allowed {
		t.Fatal("expected allowed=true")
	}
	if budget != TokenBudgetProfessional {
		t.Fatalf("expected budget=%d, got %d", TokenBudgetProfessional, budget)
	}

	// mercury (legacy) now maps to starter budget after EPIC-016 tier alignment
	_, _, mercuryBudget, _ := svc.CheckTokenLimit(ctx, "tenant2", "mercury")
	if mercuryBudget != TokenBudgetStarter {
		t.Fatalf("mercury budget mismatch: expected %d (starter), got %d", TokenBudgetStarter, mercuryBudget)
	}
}

func TestTokenBudget_EnterpriseLimitViaLegacyTier(t *testing.T) {
	repo := newStubUsageRepo()
	svc := NewUsageService(repo)
	ctx := context.Background()

	// syndicate = enterprise tier in DB
	_, _, budget, err := svc.CheckTokenLimit(ctx, "tenant3", "syndicate")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if budget != TokenBudgetEnterprise {
		t.Fatalf("expected budget=%d for syndicate, got %d", TokenBudgetEnterprise, budget)
	}

	// enterprise tier should match
	_, _, entBudget, _ := svc.CheckTokenLimit(ctx, "tenant3", "enterprise")
	if entBudget != TokenBudgetEnterprise {
		t.Fatalf("enterprise budget mismatch: expected %d, got %d", TokenBudgetEnterprise, entBudget)
	}
}

func TestTokenBudget_SovereignUnlimited(t *testing.T) {
	repo := newStubUsageRepo()
	svc := NewUsageService(repo)
	ctx := context.Background()

	// Sovereign tier — always allowed (unlimited)
	allowed, _, budget, err := svc.CheckTokenLimit(ctx, "tenant4", "sovereign")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	if !allowed {
		t.Fatal("expected allowed=true for sovereign (unlimited)")
	}
	if budget != TokenBudgetSovereign {
		t.Fatalf("expected budget=%d for sovereign, got %d", TokenBudgetSovereign, budget)
	}

	// Even after massive usage, sovereign stays allowed
	svc.IncrementTokenUsage(ctx, "tenant4", 100_000_000)
	allowed, _, _, _ = svc.CheckTokenLimit(ctx, "tenant4", "sovereign")
	if !allowed {
		t.Fatal("expected allowed=true for sovereign even at 100M tokens")
	}
}

func TestTokenBudget_IncrementZeroOrNegativeIsNoop(t *testing.T) {
	repo := newStubUsageRepo()
	svc := NewUsageService(repo)
	ctx := context.Background()

	// Zero tokens — should be a no-op
	if err := svc.IncrementTokenUsage(ctx, "tenant5", 0); err != nil {
		t.Fatalf("error: %v", err)
	}
	// Negative tokens — should be a no-op
	if err := svc.IncrementTokenUsage(ctx, "tenant5", -100); err != nil {
		t.Fatalf("error: %v", err)
	}

	_, used, _, _ := svc.CheckTokenLimit(ctx, "tenant5", "starter")
	if used != 0 {
		t.Fatalf("expected 0 tokens used after noop increments, got %d", used)
	}
}

func TestEstimateTokens_Usage(t *testing.T) {
	tests := []struct {
		name     string
		text     string
		expected int64
	}{
		{"empty", "", 0},
		{"single word", "hello", 1},  // 1 word × 1.3 = 1.3 → 1
		{"short sentence", "the quick brown fox jumps over the lazy dog", 11}, // 9 words × 1.3 = 11.7 → 11
		{"medium text", "This is a test with exactly ten words in it", 13},     // 10 words × 1.3 = 13
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := EstimateTokens(tt.text)
			if got != tt.expected {
				t.Errorf("EstimateTokens(%q) = %d, want %d", tt.text, got, tt.expected)
			}
		})
	}
}

func TestEstimateRequestTokens(t *testing.T) {
	query := "What is the effective date?"
	chunks := []string{
		"The effective date is January 1 2025",
		"This agreement shall commence on the effective date",
	}
	answer := "Based on the document, the effective date is January 1, 2025."

	total := EstimateRequestTokens(query, chunks, answer)
	if total <= 0 {
		t.Fatalf("expected positive token count, got %d", total)
	}

	// Verify it's the sum of parts
	expected := EstimateTokens(query)
	for _, c := range chunks {
		expected += EstimateTokens(c)
	}
	expected += EstimateTokens(answer)

	if total != expected {
		t.Fatalf("expected %d, got %d", expected, total)
	}
}

func TestTokenBudget_InUsageReport(t *testing.T) {
	repo := newStubUsageRepo()
	svc := NewUsageService(repo)
	ctx := context.Background()

	// Add some token usage
	svc.IncrementTokenUsage(ctx, "tenant6", 500_000)

	report, err := svc.GetUsageReport(ctx, "tenant6", "starter")
	if err != nil {
		t.Fatalf("GetUsageReport error: %v", err)
	}

	tokenUsage, ok := report.Usage[MetricTokensUsed]
	if !ok {
		t.Fatal("expected tokens_used in usage report")
	}
	if tokenUsage.Used != 500_000 {
		t.Fatalf("expected tokens used=500000, got %d", tokenUsage.Used)
	}
	if tokenUsage.Limit != TokenBudgetStarter {
		t.Fatalf("expected token limit=%d, got %d", TokenBudgetStarter, tokenUsage.Limit)
	}
	if tokenUsage.Percent != 25 {
		t.Fatalf("expected 25%%, got %d%%", tokenUsage.Percent)
	}
}
