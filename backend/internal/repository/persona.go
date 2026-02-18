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
		SELECT id, tenant_id, name, title, organization, personality,
		       voice_id, silence_threshold, channels, greeting_message,
		       email_signature, avatar_url, email_enabled, email_address,
		       created_at, updated_at
		FROM mercury_personas
		WHERE tenant_id = $1
		LIMIT 1
	`, tenantID)

	var p model.MercuryPersona
	var channels []byte
	var createdAt, updatedAt time.Time

	err := row.Scan(
		&p.ID, &p.TenantID, &p.Name, &p.Title, &p.Organization, &p.Personality,
		&p.VoiceID, &p.SilenceThreshold, &channels, &p.GreetingMessage,
		&p.EmailSignature, &p.AvatarURL, &p.EmailEnabled, &p.EmailAddress,
		&createdAt, &updatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	p.Channels = json.RawMessage(channels)
	p.CreatedAt = createdAt
	p.UpdatedAt = updatedAt

	return &p, nil
}
