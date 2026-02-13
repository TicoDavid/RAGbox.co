package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// KBHealthRepo implements KB health check persistence with pgx.
type KBHealthRepo struct {
	pool *pgxpool.Pool
}

// NewKBHealthRepo creates a KBHealthRepo.
func NewKBHealthRepo(pool *pgxpool.Pool) *KBHealthRepo {
	return &KBHealthRepo{pool: pool}
}

func (r *KBHealthRepo) InsertCheck(ctx context.Context, check *model.KBHealthCheck) error {
	err := r.pool.QueryRow(ctx, `
		INSERT INTO kb_health_checks (id, vault_id, check_type, status, details, run_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
		RETURNING id`,
		check.VaultID, check.CheckType, string(check.Status), check.Details, time.Now().UTC(),
	).Scan(&check.ID)
	if err != nil {
		return fmt.Errorf("repository.KBHealth.InsertCheck: %w", err)
	}
	return nil
}

func (r *KBHealthRepo) LatestByVault(ctx context.Context, vaultID string, limit int) ([]model.KBHealthCheck, error) {
	if limit <= 0 {
		limit = 10
	}

	rows, err := r.pool.Query(ctx, `
		SELECT id, vault_id, check_type, status, details, run_at
		FROM kb_health_checks
		WHERE vault_id = $1
		ORDER BY run_at DESC
		LIMIT $2`, vaultID, limit)
	if err != nil {
		return nil, fmt.Errorf("repository.KBHealth.LatestByVault: %w", err)
	}
	defer rows.Close()

	var checks []model.KBHealthCheck
	for rows.Next() {
		var c model.KBHealthCheck
		var statusStr string
		var detailsJSON []byte
		if err := rows.Scan(&c.ID, &c.VaultID, &c.CheckType, &statusStr, &detailsJSON, &c.RunAt); err != nil {
			return nil, fmt.Errorf("repository.KBHealth.LatestByVault: scan: %w", err)
		}
		c.Status = model.HealthStatus(statusStr)
		c.Details = json.RawMessage(detailsJSON)
		checks = append(checks, c)
	}
	return checks, nil
}
