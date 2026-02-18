package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	pgvector "github.com/pgvector/pgvector-go"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// CortexRepo handles cortex_entries persistence.
type CortexRepo struct {
	pool *pgxpool.Pool
}

// NewCortexRepo creates a CortexRepo.
func NewCortexRepo(pool *pgxpool.Pool) *CortexRepo {
	return &CortexRepo{pool: pool}
}

// Insert stores a new cortex entry.
func (r *CortexRepo) Insert(ctx context.Context, entry *model.CortexEntry) error {
	if entry.ID == "" {
		entry.ID = uuid.New().String()
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO cortex_entries (id, tenant_id, content, embedding, source_channel,
			source_message_id, captured_at, topic, is_instruction, auto_summary, expires_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`,
		entry.ID, entry.TenantID, entry.Content, entry.Embedding, entry.SourceChannel,
		entry.SourceMessageID, entry.CapturedAt, entry.Topic, entry.IsInstruction,
		entry.AutoSummary, entry.ExpiresAt, time.Now().UTC(),
	)
	return err
}

// Search finds cortex entries by recency-weighted cosine similarity.
// Weighting: 70% semantic relevance + 30% recency (decay over days).
func (r *CortexRepo) Search(ctx context.Context, tenantID string, queryEmbedding pgvector.Vector, limit int) ([]model.CortexEntry, error) {
	if limit <= 0 {
		limit = 3
	}

	rows, err := r.pool.Query(ctx, `
		SELECT id, tenant_id, content, source_channel, source_message_id,
		       captured_at, topic, is_instruction, auto_summary, expires_at
		FROM cortex_entries
		WHERE tenant_id = $1
		  AND embedding IS NOT NULL
		  AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY
			(1 - (embedding <=> $2)) * 0.7 +
			(1.0 / (1.0 + EXTRACT(EPOCH FROM (NOW() - captured_at)) / 86400.0)) * 0.3
			DESC
		LIMIT $3
	`, tenantID, queryEmbedding, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanCortexEntries(rows)
}

// GetInstructions fetches all standing instructions for a tenant.
func (r *CortexRepo) GetInstructions(ctx context.Context, tenantID string) ([]model.CortexEntry, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, tenant_id, content, source_channel, source_message_id,
		       captured_at, topic, is_instruction, auto_summary, expires_at
		FROM cortex_entries
		WHERE tenant_id = $1 AND is_instruction = true
		ORDER BY captured_at DESC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanCortexEntries(rows)
}

// DeleteExpired removes expired cortex entries. Returns count of deleted rows.
func (r *CortexRepo) DeleteExpired(ctx context.Context) (int64, error) {
	tag, err := r.pool.Exec(ctx, `
		DELETE FROM cortex_entries
		WHERE expires_at IS NOT NULL AND expires_at < NOW()
	`)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func scanCortexEntries(rows pgx.Rows) ([]model.CortexEntry, error) {
	var entries []model.CortexEntry
	for rows.Next() {
		var e model.CortexEntry
		if err := rows.Scan(
			&e.ID, &e.TenantID, &e.Content, &e.SourceChannel, &e.SourceMessageID,
			&e.CapturedAt, &e.Topic, &e.IsInstruction, &e.AutoSummary, &e.ExpiresAt,
		); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}
