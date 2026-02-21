package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// MercuryConfigRepo handles mercury_configs CRUD.
type MercuryConfigRepo struct {
	pool *pgxpool.Pool
}

// NewMercuryConfigRepo creates a new MercuryConfigRepo.
func NewMercuryConfigRepo(pool *pgxpool.Pool) *MercuryConfigRepo {
	return &MercuryConfigRepo{pool: pool}
}

// GetByUserID returns the Mercury config for a user, or nil if none exists.
func (r *MercuryConfigRepo) GetByUserID(ctx context.Context, userID string) (*model.MercuryConfig, error) {
	cfg := &model.MercuryConfig{}
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, tenant_id, name, voice_id, greeting,
		       personality_prompt, created_at, updated_at
		FROM mercury_configs WHERE user_id = $1`,
		userID,
	).Scan(
		&cfg.ID, &cfg.UserID, &cfg.TenantID, &cfg.Name, &cfg.VoiceID,
		&cfg.Greeting, &cfg.PersonalityPrompt, &cfg.CreatedAt, &cfg.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("mercury_config.GetByUserID: %w", err)
	}
	return cfg, nil
}

// Upsert creates or updates a Mercury config for a user.
func (r *MercuryConfigRepo) Upsert(ctx context.Context, userID string, cfg *model.MercuryConfig) (*model.MercuryConfig, error) {
	result := &model.MercuryConfig{}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO mercury_configs (user_id, tenant_id, name, voice_id, greeting, personality_prompt)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (user_id) DO UPDATE SET
			tenant_id = COALESCE(EXCLUDED.tenant_id, mercury_configs.tenant_id),
			name = EXCLUDED.name,
			voice_id = EXCLUDED.voice_id,
			greeting = EXCLUDED.greeting,
			personality_prompt = EXCLUDED.personality_prompt,
			updated_at = NOW()
		RETURNING id, user_id, tenant_id, name, voice_id, greeting,
		          personality_prompt, created_at, updated_at`,
		userID, cfg.TenantID, cfg.Name, cfg.VoiceID, cfg.Greeting, cfg.PersonalityPrompt,
	).Scan(
		&result.ID, &result.UserID, &result.TenantID, &result.Name, &result.VoiceID,
		&result.Greeting, &result.PersonalityPrompt, &result.CreatedAt, &result.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("mercury_config.Upsert: %w", err)
	}
	return result, nil
}
