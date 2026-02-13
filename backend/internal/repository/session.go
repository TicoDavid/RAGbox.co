package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// SessionRepo implements learning session persistence with pgx.
type SessionRepo struct {
	pool *pgxpool.Pool
}

// NewSessionRepo creates a SessionRepo.
func NewSessionRepo(pool *pgxpool.Pool) *SessionRepo {
	return &SessionRepo{pool: pool}
}

func (r *SessionRepo) Create(ctx context.Context, session *model.LearningSession) error {
	now := time.Now().UTC()
	err := r.pool.QueryRow(ctx, `
		INSERT INTO learning_sessions (id, user_id, vault_id, status, topics_covered, documents_queried, query_count, total_duration_ms, created_at, updated_at)
		VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at`,
		session.UserID, session.VaultID, string(session.Status),
		session.TopicsCovered, session.DocumentsQueried,
		session.QueryCount, session.TotalDurationMs, now, now,
	).Scan(&session.ID, &session.CreatedAt)
	if err != nil {
		return fmt.Errorf("repository.Session.Create: %w", err)
	}
	session.UpdatedAt = now
	return nil
}

func (r *SessionRepo) GetByID(ctx context.Context, id string) (*model.LearningSession, error) {
	s := &model.LearningSession{}
	var statusStr string
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, vault_id, status, topics_covered, documents_queried, query_count, total_duration_ms, created_at, updated_at
		FROM learning_sessions WHERE id = $1`, id,
	).Scan(&s.ID, &s.UserID, &s.VaultID, &statusStr, &s.TopicsCovered, &s.DocumentsQueried,
		&s.QueryCount, &s.TotalDurationMs, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("repository.Session.GetByID: %w", err)
	}
	s.Status = model.SessionStatus(statusStr)
	return s, nil
}

func (r *SessionRepo) GetActive(ctx context.Context, userID string) (*model.LearningSession, error) {
	s := &model.LearningSession{}
	var statusStr string
	err := r.pool.QueryRow(ctx, `
		SELECT id, user_id, vault_id, status, topics_covered, documents_queried, query_count, total_duration_ms, created_at, updated_at
		FROM learning_sessions WHERE user_id = $1 AND status = 'active'
		ORDER BY created_at DESC LIMIT 1`, userID,
	).Scan(&s.ID, &s.UserID, &s.VaultID, &statusStr, &s.TopicsCovered, &s.DocumentsQueried,
		&s.QueryCount, &s.TotalDurationMs, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("repository.Session.GetActive: %w", err)
	}
	s.Status = model.SessionStatus(statusStr)
	return s, nil
}

func (r *SessionRepo) Update(ctx context.Context, session *model.LearningSession) error {
	now := time.Now().UTC()
	_, err := r.pool.Exec(ctx, `
		UPDATE learning_sessions
		SET status = $1, topics_covered = $2, documents_queried = $3, query_count = $4, total_duration_ms = $5, updated_at = $6
		WHERE id = $7`,
		string(session.Status), session.TopicsCovered, session.DocumentsQueried,
		session.QueryCount, session.TotalDurationMs, now, session.ID,
	)
	if err != nil {
		return fmt.Errorf("repository.Session.Update: %w", err)
	}
	session.UpdatedAt = now
	return nil
}
