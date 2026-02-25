package service

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"
)

// UsageRepository defines the interface for usage data access.
// Implemented by repository.UsageRepo.
type UsageRepository interface {
	Increment(ctx context.Context, userID, metric string) error
	IncrementBy(ctx context.Context, userID, metric string, amount int64) error
	GetUsage(ctx context.Context, userID, metric string) (int64, error)
	GetAllUsage(ctx context.Context, userID string) ([]UsageRecord, error)
}

// UsageRecord represents a single usage metric for a billing period.
type UsageRecord struct {
	UserID      string
	Metric      string
	Count       int64
	PeriodStart time.Time
	PeriodEnd   time.Time
}

// TierLimits defines per-metric limits for a subscription tier.
type TierLimits struct {
	AegisQueries    int64 `json:"aegis_queries"`
	DocumentsStored int64 `json:"documents_stored"` // -1 = unlimited
	VoiceMinutes    int64 `json:"voice_minutes"`
	APICalls        int64 `json:"api_calls"`
	TokenBudget     int64 `json:"token_budget"` // monthly token allocation; -1 = unlimited (STORY-199)
}

// Token budget constants — CPO-approved allocations (STORY-199).
const (
	TokenBudgetStarter      int64 = 2_000_000  // Starter tier: $149/mo
	TokenBudgetProfessional int64 = 5_000_000  // Professional tier: $399/mo
	TokenBudgetEnterprise   int64 = 15_000_000 // Enterprise tier: $999/mo
	TokenBudgetSovereign    int64 = -1          // Sovereign tier: contract-based, no hard limit
	TokenBudgetFree         int64 = 500_000     // Free/trial tier: limited
)

// MetricTokensUsed is the usage_tracking metric key for token consumption.
const MetricTokensUsed = "tokens_used"

// TierLimitMap maps subscription tier names to their limits.
// EPIC-016: Canonical tier names are free/starter/professional/enterprise/sovereign.
// Legacy names (mercury/syndicate) kept for backward compat with unmigrated DB rows.
var TierLimitMap = map[string]TierLimits{
	// ── Canonical tiers (CPO pricing model — EPIC-016) ────────────────
	"free": {
		AegisQueries:    25,
		DocumentsStored: 5,
		VoiceMinutes:    0,
		APICalls:        0,
		TokenBudget:     TokenBudgetFree,
	},
	"starter": {
		AegisQueries:    100,
		DocumentsStored: 10,
		VoiceMinutes:    60,
		APICalls:        100,
		TokenBudget:     TokenBudgetStarter,
	},
	"professional": {
		AegisQueries:    500,
		DocumentsStored: 50,
		VoiceMinutes:    120,
		APICalls:        500,
		TokenBudget:     TokenBudgetProfessional,
	},
	"enterprise": {
		AegisQueries:    10000,
		DocumentsStored: -1, // unlimited
		VoiceMinutes:    -1, // unlimited
		APICalls:        10000,
		TokenBudget:     TokenBudgetEnterprise,
	},
	"sovereign": {
		AegisQueries:    500,
		DocumentsStored: 50,
		VoiceMinutes:    0,
		APICalls:        0,
		TokenBudget:     TokenBudgetSovereign, // unlimited — contract-based
	},
	// ── Legacy aliases (backward compat for unmigrated DB rows) ───────
	"mercury": { // @deprecated → maps to starter
		AegisQueries:    100,
		DocumentsStored: 10,
		VoiceMinutes:    60,
		APICalls:        100,
		TokenBudget:     TokenBudgetStarter,
	},
	"syndicate": { // @deprecated → maps to enterprise
		AegisQueries:    10000,
		DocumentsStored: -1,
		VoiceMinutes:    -1,
		APICalls:        10000,
		TokenBudget:     TokenBudgetEnterprise,
	},
}

// MetricUsage represents usage and limit for a single metric.
type MetricUsage struct {
	Used    int64 `json:"used"`
	Limit   int64 `json:"limit"`
	Percent int   `json:"percent"`
}

// UsageResponse is the full usage report for a tenant.
type UsageResponse struct {
	Tier    string                 `json:"tier"`
	Period  PeriodInfo             `json:"period"`
	Usage   map[string]MetricUsage `json:"usage"`
	Overage OverageInfo            `json:"overage"`
}

// PeriodInfo describes the current billing period.
type PeriodInfo struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

// OverageInfo describes overage pricing (future use).
type OverageInfo struct {
	Enabled bool               `json:"enabled"`
	Rates   map[string]float64 `json:"rates"`
}

// UsageService provides usage tracking and limit enforcement.
type UsageService struct {
	repo UsageRepository
}

// NewUsageService creates a new usage service.
func NewUsageService(repo UsageRepository) *UsageService {
	return &UsageService{repo: repo}
}

// IncrementUsage records one unit of usage for a metric.
func (s *UsageService) IncrementUsage(ctx context.Context, userID, metric string) error {
	if err := s.repo.Increment(ctx, userID, metric); err != nil {
		slog.Error("[Usage] Failed to increment", "user_id", userID, "metric", metric, "error", err)
		return err
	}
	return nil
}

// CheckLimit returns whether the user is within their tier limit for a metric.
// Returns (allowed, currentCount, limit, error).
func (s *UsageService) CheckLimit(ctx context.Context, userID, metric, tier string) (bool, int64, int64, error) {
	limits, ok := TierLimitMap[tier]
	if !ok {
		limits = TierLimitMap["free"]
	}

	var limit int64
	switch metric {
	case "aegis_queries":
		limit = limits.AegisQueries
	case "documents_stored":
		limit = limits.DocumentsStored
	case "voice_minutes":
		limit = limits.VoiceMinutes
	case "api_calls":
		limit = limits.APICalls
	case MetricTokensUsed:
		limit = limits.TokenBudget
	default:
		return true, 0, 0, nil // unknown metric, allow
	}

	if limit == -1 {
		return true, 0, -1, nil // unlimited
	}

	count, err := s.repo.GetUsage(ctx, userID, metric)
	if err != nil {
		return false, 0, limit, err
	}

	return count < limit, count, limit, nil
}

// GetUsageReport returns the full usage report for a user.
func (s *UsageService) GetUsageReport(ctx context.Context, userID, tier string) (*UsageResponse, error) {
	limits, ok := TierLimitMap[tier]
	if !ok {
		limits = TierLimitMap["free"]
		tier = "free"
	}

	records, err := s.repo.GetAllUsage(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get usage: %w", err)
	}

	// Build map of metric → count
	usageMap := map[string]int64{}
	for _, rec := range records {
		usageMap[rec.Metric] = rec.Count
	}

	// Build response
	now := time.Now().UTC()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	periodEnd := periodStart.AddDate(0, 1, 0)

	metrics := map[string]int64{
		"aegis_queries":    limits.AegisQueries,
		"documents_stored": limits.DocumentsStored,
		"voice_minutes":    limits.VoiceMinutes,
		"api_calls":        limits.APICalls,
		MetricTokensUsed:   limits.TokenBudget,
	}

	usage := map[string]MetricUsage{}
	for metric, limit := range metrics {
		used := usageMap[metric]
		pct := 0
		if limit > 0 {
			pct = int(float64(used) / float64(limit) * 100)
			if pct > 100 {
				pct = 100
			}
		}
		usage[metric] = MetricUsage{
			Used:    used,
			Limit:   limit,
			Percent: pct,
		}
	}

	return &UsageResponse{
		Tier: tier,
		Period: PeriodInfo{
			Start: periodStart.Format("2006-01-02"),
			End:   periodEnd.Format("2006-01-02"),
		},
		Usage: usage,
		Overage: OverageInfo{
			Enabled: false,
			Rates: map[string]float64{
				"aegis_query":  0.02,
				"document":     0.50,
				"voice_minute": 0.15,
			},
		},
	}, nil
}

// ── Token allocation enforcement (STORY-199) ─────────────────────────

// CheckTokenLimit returns whether the user is within their tier's monthly token budget.
// Returns (allowed, tokensUsed, tokenBudget, error).
// Sovereign tier is always allowed (unlimited).
func (s *UsageService) CheckTokenLimit(ctx context.Context, userID, tier string) (bool, int64, int64, error) {
	return s.CheckLimit(ctx, userID, MetricTokensUsed, tier)
}

// IncrementTokenUsage records token consumption for a completed LLM call.
// The amount is the total tokens (input + output) estimated for the request.
// Does NOT fail the current request — this is a post-response fire-and-forget operation.
func (s *UsageService) IncrementTokenUsage(ctx context.Context, userID string, tokens int64) error {
	if tokens <= 0 {
		return nil
	}
	if err := s.repo.IncrementBy(ctx, userID, MetricTokensUsed, tokens); err != nil {
		slog.Error("[Usage] Failed to increment tokens", "user_id", userID, "tokens", tokens, "error", err)
		return err
	}
	slog.Info("[Usage] Token usage recorded", "user_id", userID, "tokens", tokens)
	return nil
}

// EstimateTokens approximates the token count for a given text.
// Uses the established words × 1.3 heuristic, consistent with the chunker.
func EstimateTokens(text string) int64 {
	if text == "" {
		return 0
	}
	words := len(strings.Fields(text))
	return int64(float64(words) * 1.3)
}

// EstimateRequestTokens calculates the total token cost for a chat request:
// input tokens (query + context chunks) + output tokens (generated answer).
func EstimateRequestTokens(query string, chunkTexts []string, answer string) int64 {
	var total int64

	// Input: query
	total += EstimateTokens(query)

	// Input: context chunks sent to LLM
	for _, chunk := range chunkTexts {
		total += EstimateTokens(chunk)
	}

	// Output: generated answer
	total += EstimateTokens(answer)

	return total
}
