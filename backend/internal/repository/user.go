package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// UserRepo handles user persistence.
type UserRepo struct {
	pool *pgxpool.Pool
}

// NewUserRepo creates a UserRepo.
func NewUserRepo(pool *pgxpool.Pool) *UserRepo {
	return &UserRepo{pool: pool}
}

// EnsureUser creates a user record if it doesn't already exist.
// Uses the user ID as both the primary key and email (for internal auth,
// the user ID is typically an email address from NextAuth).
func (r *UserRepo) EnsureUser(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO users (id, email, role, status, created_at, last_login_at)
		VALUES ($1, $1, 'Associate', 'Active', now(), now())
		ON CONFLICT (id) DO UPDATE SET last_login_at = now()
	`, userID)
	return err
}
