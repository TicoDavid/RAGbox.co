package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// InsightRepo implements service.InsightRepository with pgx.
type InsightRepo struct {
	pool *pgxpool.Pool
}

// NewInsightRepo creates an InsightRepo.
func NewInsightRepo(pool *pgxpool.Pool) *InsightRepo {
	return &InsightRepo{pool: pool}
}

// Compile-time check.
var _ service.InsightRepository = (*InsightRepo)(nil)

func (r *InsightRepo) CreateInsight(ctx context.Context, insight *model.ProactiveInsight) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO mercury_proactive_insights (
			id, user_id, tenant_id, document_id, insight_type, title, summary,
			source_chunk_id, relevance_score, expires_at, acknowledged, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7,
			$8, $9, $10, $11, $12, $13
		)`,
		insight.ID, insight.UserID, insight.TenantID, insight.DocumentID,
		string(insight.InsightType), insight.Title, insight.Summary,
		insight.SourceChunkID, insight.RelevanceScore, insight.ExpiresAt,
		insight.Acknowledged, insight.CreatedAt, insight.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("repository.CreateInsight: %w", err)
	}
	return nil
}

func (r *InsightRepo) GetActiveInsights(ctx context.Context, userID string, limit int) ([]model.ProactiveInsight, error) {
	if limit <= 0 {
		limit = 10
	}

	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, tenant_id, document_id, insight_type, title, summary,
			source_chunk_id, relevance_score, expires_at, acknowledged, created_at, updated_at
		FROM mercury_proactive_insights
		WHERE user_id = $1
			AND acknowledged = FALSE
			AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY relevance_score DESC
		LIMIT $2`, userID, limit)
	if err != nil {
		return nil, fmt.Errorf("repository.GetActiveInsights: %w", err)
	}
	defer rows.Close()

	var insights []model.ProactiveInsight
	for rows.Next() {
		var ins model.ProactiveInsight
		var insightType string
		if err := rows.Scan(
			&ins.ID, &ins.UserID, &ins.TenantID, &ins.DocumentID,
			&insightType, &ins.Title, &ins.Summary,
			&ins.SourceChunkID, &ins.RelevanceScore, &ins.ExpiresAt,
			&ins.Acknowledged, &ins.CreatedAt, &ins.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("repository.GetActiveInsights: scan: %w", err)
		}
		ins.InsightType = model.InsightType(insightType)
		insights = append(insights, ins)
	}

	return insights, nil
}

func (r *InsightRepo) AcknowledgeInsight(ctx context.Context, insightID string) error {
	tag, err := r.pool.Exec(ctx, `
		UPDATE mercury_proactive_insights
		SET acknowledged = TRUE, updated_at = NOW()
		WHERE id = $1`, insightID)
	if err != nil {
		return fmt.Errorf("repository.AcknowledgeInsight: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("repository.AcknowledgeInsight: insight not found")
	}
	return nil
}

func (r *InsightRepo) DeleteExpiredInsights(ctx context.Context) (int, error) {
	tag, err := r.pool.Exec(ctx, `
		DELETE FROM mercury_proactive_insights
		WHERE expires_at IS NOT NULL AND expires_at < $1`, time.Now().UTC())
	if err != nil {
		return 0, fmt.Errorf("repository.DeleteExpiredInsights: %w", err)
	}
	return int(tag.RowsAffected()), nil
}

func (r *InsightRepo) ExistsByHash(ctx context.Context, userID, documentID, insightType, hash string) (bool, error) {
	var exists bool
	err := r.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM mercury_proactive_insights
			WHERE user_id = $1 AND document_id = $2::uuid
				AND insight_type = $3 AND encode(sha256(title::bytea), 'hex') = $4
		)`, userID, documentID, insightType, hash).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("repository.ExistsByHash: %w", err)
	}
	return exists, nil
}
