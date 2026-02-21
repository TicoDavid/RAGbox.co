package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// UsageRepo provides database access for usage tracking.
type UsageRepo struct {
	pool *pgxpool.Pool
}

// NewUsageRepo creates a new usage repository.
func NewUsageRepo(pool *pgxpool.Pool) *UsageRepo {
	return &UsageRepo{pool: pool}
}

// Increment atomically increments a usage metric for the current billing period.
func (r *UsageRepo) Increment(ctx context.Context, userID, metric string) error {
	now := time.Now().UTC()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	periodEnd := periodStart.AddDate(0, 1, 0)

	_, err := r.pool.Exec(ctx, `
		INSERT INTO usage_tracking (user_id, metric, count, period_start, period_end)
		VALUES ($1, $2, 1, $3, $4)
		ON CONFLICT (user_id, metric, period_start)
		DO UPDATE SET count = usage_tracking.count + 1, updated_at = NOW()
	`, userID, metric, periodStart, periodEnd)
	return err
}

// GetUsage returns the current usage count for a specific metric in the current period.
func (r *UsageRepo) GetUsage(ctx context.Context, userID, metric string) (int64, error) {
	now := time.Now().UTC()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)

	var count int64
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(count, 0) FROM usage_tracking
		WHERE user_id = $1 AND metric = $2 AND period_start = $3
	`, userID, metric, periodStart).Scan(&count)

	if err != nil {
		if err.Error() == "no rows in result set" {
			return 0, nil
		}
		return 0, err
	}

	return count, nil
}

// GetAllUsage returns all usage metrics for a user in the current period.
func (r *UsageRepo) GetAllUsage(ctx context.Context, userID string) ([]service.UsageRecord, error) {
	now := time.Now().UTC()
	periodStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)

	rows, err := r.pool.Query(ctx, `
		SELECT user_id, metric, count, period_start, period_end
		FROM usage_tracking
		WHERE user_id = $1 AND period_start = $2
		ORDER BY metric
	`, userID, periodStart)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []service.UsageRecord
	for rows.Next() {
		var rec service.UsageRecord
		if err := rows.Scan(&rec.UserID, &rec.Metric, &rec.Count, &rec.PeriodStart, &rec.PeriodEnd); err != nil {
			return nil, err
		}
		records = append(records, rec)
	}
	return records, rows.Err()
}
