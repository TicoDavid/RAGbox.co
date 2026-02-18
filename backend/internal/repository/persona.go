package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// PersonaRepo handles MercuryPersona persistence.
type PersonaRepo struct {
	pool *pgxpool.Pool
}

// NewPersonaRepo creates a PersonaRepo.
func NewPersonaRepo(pool *pgxpool.Pool) *PersonaRepo {
	return &PersonaRepo{pool: pool}
}

// GetByTenantID fetches the persona configured for a tenant.
// Returns (nil, nil) if no persona is configured — callers should fall back to default prompt.
func (r *PersonaRepo) GetByTenantID(ctx context.Context, tenantID string) (*model.MercuryPersona, error) {
	row := r.pool.QueryRow(ctx, `
		SELECT id, tenant_id, first_name, last_name, title, personality_prompt,
		       voice_id, silence_high_threshold, silence_med_threshold,
		       channel_config, greeting, signature_block, avatar_url,
		       is_active, email_enabled, email_address,
		       created_at, updated_at
		FROM mercury_personas
		WHERE tenant_id = $1
		LIMIT 1
	`, tenantID)

	var p model.MercuryPersona
	var channelConfig []byte
	var createdAt, updatedAt time.Time

	err := row.Scan(
		&p.ID, &p.TenantID, &p.FirstName, &p.LastName, &p.Title, &p.PersonalityPrompt,
		&p.VoiceID, &p.SilenceHighThreshold, &p.SilenceMedThreshold,
		&channelConfig, &p.Greeting, &p.SignatureBlock, &p.AvatarURL,
		&p.IsActive, &p.EmailEnabled, &p.EmailAddress,
		&createdAt, &updatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	p.ChannelConfig = json.RawMessage(channelConfig)
	p.CreatedAt = createdAt
	p.UpdatedAt = updatedAt

	return &p, nil
}
