package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// AuditRepo provides database operations for audit logs.
type AuditRepo struct {
	pool *pgxpool.Pool
}

// NewAuditRepo creates an AuditRepo.
func NewAuditRepo(pool *pgxpool.Pool) *AuditRepo {
	return &AuditRepo{pool: pool}
}

// Create inserts a new audit log entry.
func (r *AuditRepo) Create(ctx context.Context, entry *model.AuditLog) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO audit_logs (id, user_id, action, resource_id, resource_type, severity, details, details_hash, ip_address, user_agent, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		entry.ID, entry.UserID, entry.Action, entry.ResourceID, entry.ResourceType,
		entry.Severity, entry.Details, entry.DetailsHash,
		entry.IPAddress, entry.UserAgent, entry.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("repository.AuditCreate: %w", err)
	}
	return nil
}

// ListFilter defines filters for listing audit logs.
type ListFilter struct {
	UserID     string
	Action     string
	Severity   string
	StartDate  string // ISO 8601
	EndDate    string // ISO 8601
	Limit      int
	Offset     int
}

// List returns paginated audit logs matching the given filters.
func (r *AuditRepo) List(ctx context.Context, f ListFilter) ([]model.AuditLog, int, error) {
	if f.Limit <= 0 {
		f.Limit = 50
	}

	query := `SELECT id, user_id, action, resource_id, resource_type, severity, details, details_hash, ip_address, user_agent, created_at FROM audit_logs WHERE 1=1`
	countQuery := `SELECT count(*) FROM audit_logs WHERE 1=1`
	var args []interface{}
	argIdx := 1

	if f.UserID != "" {
		clause := fmt.Sprintf(` AND user_id = $%d`, argIdx)
		query += clause
		countQuery += clause
		args = append(args, f.UserID)
		argIdx++
	}
	if f.Action != "" {
		clause := fmt.Sprintf(` AND action = $%d`, argIdx)
		query += clause
		countQuery += clause
		args = append(args, f.Action)
		argIdx++
	}
	if f.Severity != "" {
		clause := fmt.Sprintf(` AND severity = $%d`, argIdx)
		query += clause
		countQuery += clause
		args = append(args, f.Severity)
		argIdx++
	}
	if f.StartDate != "" {
		clause := fmt.Sprintf(` AND created_at >= $%d`, argIdx)
		query += clause
		countQuery += clause
		args = append(args, f.StartDate)
		argIdx++
	}
	if f.EndDate != "" {
		clause := fmt.Sprintf(` AND created_at <= $%d`, argIdx)
		query += clause
		countQuery += clause
		args = append(args, f.EndDate)
		argIdx++
	}

	// Count total
	var total int
	err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("repository.AuditList count: %w", err)
	}

	query += ` ORDER BY created_at DESC`
	query += fmt.Sprintf(` LIMIT $%d OFFSET $%d`, argIdx, argIdx+1)
	args = append(args, f.Limit, f.Offset)

	rows, err := r.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("repository.AuditList: %w", err)
	}
	defer rows.Close()

	var entries []model.AuditLog
	for rows.Next() {
		var e model.AuditLog
		err := rows.Scan(&e.ID, &e.UserID, &e.Action, &e.ResourceID, &e.ResourceType,
			&e.Severity, &e.Details, &e.DetailsHash, &e.IPAddress, &e.UserAgent, &e.CreatedAt)
		if err != nil {
			return nil, 0, fmt.Errorf("repository.AuditList scan: %w", err)
		}
		entries = append(entries, e)
	}

	return entries, total, nil
}

// GetRange returns audit entries between two IDs (inclusive) ordered by created_at.
func (r *AuditRepo) GetRange(ctx context.Context, startID, endID string) ([]model.AuditLog, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, user_id, action, resource_id, resource_type, severity, details, details_hash, ip_address, user_agent, created_at
		FROM audit_logs
		WHERE created_at >= (SELECT created_at FROM audit_logs WHERE id = $1)
		  AND created_at <= (SELECT created_at FROM audit_logs WHERE id = $2)
		ORDER BY created_at ASC`,
		startID, endID)
	if err != nil {
		return nil, fmt.Errorf("repository.AuditGetRange: %w", err)
	}
	defer rows.Close()

	var entries []model.AuditLog
	for rows.Next() {
		var e model.AuditLog
		err := rows.Scan(&e.ID, &e.UserID, &e.Action, &e.ResourceID, &e.ResourceType,
			&e.Severity, &e.Details, &e.DetailsHash, &e.IPAddress, &e.UserAgent, &e.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("repository.AuditGetRange scan: %w", err)
		}
		entries = append(entries, e)
	}

	return entries, nil
}

// GetLatestHash returns the details_hash of the most recent audit entry.
func (r *AuditRepo) GetLatestHash(ctx context.Context) (string, error) {
	var hash *string
	err := r.pool.QueryRow(ctx, `SELECT details_hash FROM audit_logs ORDER BY created_at DESC LIMIT 1`).Scan(&hash)
	if err != nil {
		// No entries yet — return empty string (genesis)
		return "", nil
	}
	if hash == nil {
		return "", nil
	}
	return *hash, nil
}
