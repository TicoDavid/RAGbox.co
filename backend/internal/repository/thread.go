package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// ThreadRepo handles mercury_threads and mercury_thread_messages persistence.
type ThreadRepo struct {
	pool *pgxpool.Pool
}

// NewThreadRepo creates a ThreadRepo.
func NewThreadRepo(pool *pgxpool.Pool) *ThreadRepo {
	return &ThreadRepo{pool: pool}
}

// GetOrCreateThread finds the user's most recent thread or creates one.
// Returns the thread ID.
func (r *ThreadRepo) GetOrCreateThread(ctx context.Context, userID string) (string, error) {
	// Try to find existing thread
	var threadID string
	err := r.pool.QueryRow(ctx, `
		SELECT id FROM mercury_threads
		WHERE user_id = $1
		ORDER BY updated_at DESC
		LIMIT 1
	`, userID).Scan(&threadID)

	if err == nil {
		return threadID, nil
	}

	// Create new thread
	threadID = uuid.New().String()
	_, err = r.pool.Exec(ctx, `
		INSERT INTO mercury_threads (id, tenant_id, user_id, title, created_at, updated_at)
		VALUES ($1, 'default', $2, 'Mercury Thread', $3, $3)
	`, threadID, userID, time.Now().UTC())
	if err != nil {
		return "", fmt.Errorf("repository.ThreadRepo.GetOrCreateThread: create: %w", err)
	}

	return threadID, nil
}

// SaveMessage inserts a message into the unified thread and touches updated_at.
func (r *ThreadRepo) SaveMessage(ctx context.Context, msg *model.MercuryThreadMessage) error {
	if msg.ID == "" {
		msg.ID = uuid.New().String()
	}
	if msg.CreatedAt.IsZero() {
		msg.CreatedAt = time.Now().UTC()
	}

	_, err := r.pool.Exec(ctx, `
		INSERT INTO mercury_thread_messages
			(id, thread_id, role, channel, content, confidence, channel_message_id, direction, created_at)
		VALUES ($1, $2, $3, $4::mercury_channel, $5, $6, $7, $8, $9)
	`,
		msg.ID, msg.ThreadID, msg.Role, msg.Channel, msg.Content,
		msg.Confidence, msg.ChannelMessageID, msg.Direction, msg.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("repository.ThreadRepo.SaveMessage: %w", err)
	}

	// Touch thread updated_at
	_, err = r.pool.Exec(ctx, `
		UPDATE mercury_threads SET updated_at = $1 WHERE id = $2
	`, time.Now().UTC(), msg.ThreadID)
	if err != nil {
		return fmt.Errorf("repository.ThreadRepo.SaveMessage: touch thread: %w", err)
	}

	return nil
}
