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

// GetUserRole returns the role for a user (e.g. "Partner", "Associate", "Auditor").
// Returns "Associate" if the user is not found (STORY-S01).
func (r *UserRepo) GetUserRole(ctx context.Context, userID string) (string, error) {
	var role string
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(role, 'Associate') FROM users WHERE id = $1
	`, userID).Scan(&role)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return "Associate", nil
		}
		return "Associate", err
	}
	return role, nil
}

// GetSubscriptionTier returns the subscription tier for a user.
// Returns "free" if the user is not found or has no tier set (STORY-199).
func (r *UserRepo) GetSubscriptionTier(ctx context.Context, userID string) (string, error) {
	var tier string
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(subscription_tier, 'free') FROM users WHERE id = $1
	`, userID).Scan(&tier)
	if err != nil {
		if err.Error() == "no rows in result set" {
			return "free", nil
		}
		return "free", err
	}
	return tier, nil
}
