package service

import (
	"context"
	"fmt"
	"log/slog"
	"time"
)

// UsageRepository defines the interface for usage data access.
// Implemented by repository.UsageRepo.
type UsageRepository interface {
	Increment(ctx context.Context, userID, metric string) error
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
}

// TierLimitMap maps subscription tier names to their limits.
var TierLimitMap = map[string]TierLimits{
	"free": {
		AegisQueries:    25,
		DocumentsStored: 5,
		VoiceMinutes:    0,
		APICalls:        0,
	},
	"sovereign": {
		AegisQueries:    500,
		DocumentsStored: 50,
		VoiceMinutes:    0,
		APICalls:        0,
	},
	"mercury": {
		AegisQueries:    500,
		DocumentsStored: 50,
		VoiceMinutes:    120,
		APICalls:        0,
	},
	"syndicate": {
		AegisQueries:    10000,
		DocumentsStored: -1, // unlimited
		VoiceMinutes:    -1, // unlimited
		APICalls:        10000,
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
