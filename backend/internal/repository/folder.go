package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// FolderRepo implements service.FolderRepository with pgx.
type FolderRepo struct {
	pool *pgxpool.Pool
}

// NewFolderRepo creates a FolderRepo.
func NewFolderRepo(pool *pgxpool.Pool) *FolderRepo {
	return &FolderRepo{pool: pool}
}

// Compile-time check.
var _ service.FolderRepository = (*FolderRepo)(nil)

func (r *FolderRepo) Create(ctx context.Context, folder *model.Folder) error {
	_, err := r.pool.Exec(ctx,
		`INSERT INTO folders (id, name, user_id, parent_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
		folder.ID, folder.Name, folder.UserID, folder.ParentID, folder.CreatedAt, folder.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("repository.FolderCreate: %w", err)
	}
	return nil
}

func (r *FolderRepo) ListByUser(ctx context.Context, userID string) ([]model.Folder, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, name, user_id, parent_id, created_at, updated_at FROM folders WHERE user_id = $1 ORDER BY name`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("repository.FolderListByUser: %w", err)
	}
	defer rows.Close()

	var folders []model.Folder
	for rows.Next() {
		var f model.Folder
		if err := rows.Scan(&f.ID, &f.Name, &f.UserID, &f.ParentID, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, fmt.Errorf("repository.FolderListByUser scan: %w", err)
		}
		folders = append(folders, f)
	}
	return folders, nil
}

func (r *FolderRepo) Delete(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM folders WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("repository.FolderDelete: %w", err)
	}
	return nil
}
