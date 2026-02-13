package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lib/pq"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// ContentGapRepo implements content gap persistence with pgx.
type ContentGapRepo struct {
	pool *pgxpool.Pool
}

// NewContentGapRepo creates a ContentGapRepo.
func NewContentGapRepo(pool *pgxpool.Pool) *ContentGapRepo {
	return &ContentGapRepo{pool: pool}
}

func (r *ContentGapRepo) Insert(ctx context.Context, gap *model.ContentGap) error {
	err := r.pool.QueryRow(ctx, `
		INSERT INTO content_gaps (id, user_id, query_text, confidence_score, suggested_topics, status, created_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)
		RETURNING id, created_at`,
		gap.UserID, gap.QueryText, gap.ConfidenceScore, pq.Array(gap.SuggestedTopics),
		string(gap.Status), time.Now().UTC(),
	).Scan(&gap.ID, &gap.CreatedAt)
	if err != nil {
		return fmt.Errorf("repository.ContentGap.Insert: %w", err)
	}
	return nil
}

func (r *ContentGapRepo) ListByUser(ctx context.Context, userID string, status string, limit int) ([]model.ContentGap, error) {
	if limit <= 0 {
		limit = 20
	}

	query := `SELECT id, user_id, query_text, confidence_score, suggested_topics, status, addressed_at, created_at
		FROM content_gaps WHERE user_id = $1`
	args := []interface{}{userID}
	argIdx := 2

	if status != "" {
		query += fmt.Sprintf(` AND status = $%d`, argIdx)
		args = append(args, status)
		argIdx++
	}

	query += fmt.Sprintf(` ORDER BY created_at DESC LIMIT $%d`, argIdx)
	args = append(args, limit)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("repository.ContentGap.ListByUser: %w", err)
	}
	defer rows.Close()

	var gaps []model.ContentGap
	for rows.Next() {
		var g model.ContentGap
		var statusStr string
		if err := rows.Scan(&g.ID, &g.UserID, &g.QueryText, &g.ConfidenceScore,
			pq.Array(&g.SuggestedTopics), &statusStr, &g.AddressedAt, &g.CreatedAt); err != nil {
			return nil, fmt.Errorf("repository.ContentGap.ListByUser: scan: %w", err)
		}
		g.Status = model.GapStatus(statusStr)
		gaps = append(gaps, g)
	}
	return gaps, nil
}

func (r *ContentGapRepo) UpdateStatus(ctx context.Context, id string, status model.GapStatus) error {
	query := `UPDATE content_gaps SET status = $1`
	args := []interface{}{string(status)}

	if status == model.GapStatusAddressed {
		query += `, addressed_at = $2 WHERE id = $3`
		args = append(args, time.Now().UTC(), id)
	} else {
		query += ` WHERE id = $2`
		args = append(args, id)
	}

	_, err := r.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("repository.ContentGap.UpdateStatus: %w", err)
	}
	return nil
}

func (r *ContentGapRepo) CountByUser(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx,
		`SELECT count(*) FROM content_gaps WHERE user_id = $1 AND status = 'open'`,
		userID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("repository.ContentGap.CountByUser: %w", err)
	}
	return count, nil
}
