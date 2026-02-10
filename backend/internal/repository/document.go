package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// DocumentRepo implements service.DocumentRepository with pgx.
type DocumentRepo struct {
	pool *pgxpool.Pool
}

// NewDocumentRepo creates a DocumentRepo.
func NewDocumentRepo(pool *pgxpool.Pool) *DocumentRepo {
	return &DocumentRepo{pool: pool}
}

// Compile-time check that DocumentRepo implements service.DocumentRepository.
var _ service.DocumentRepository = (*DocumentRepo)(nil)

func (r *DocumentRepo) Create(ctx context.Context, doc *model.Document) error {
	metaJSON, err := marshalMeta(doc.Metadata)
	if err != nil {
		return fmt.Errorf("repository.Create: marshal metadata: %w", err)
	}

	_, err = r.pool.Exec(ctx, `
		INSERT INTO documents (
			id, vault_id, user_id, filename, original_name, mime_type, file_type,
			size_bytes, storage_uri, storage_path, extracted_text, index_status,
			deletion_status, is_privileged, security_tier, chunk_count, checksum,
			folder_id, metadata, deleted_at, hard_delete_at, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7,
			$8, $9, $10, $11, $12,
			$13, $14, $15, $16, $17,
			$18, $19, $20, $21, $22, $23
		)`,
		doc.ID, doc.VaultID, doc.UserID, doc.Filename, doc.OriginalName, doc.MimeType, doc.FileType,
		doc.SizeBytes, doc.StorageURI, doc.StoragePath, doc.ExtractedText, string(doc.IndexStatus),
		string(doc.DeletionStatus), doc.IsPrivileged, doc.SecurityTier, doc.ChunkCount, doc.Checksum,
		doc.FolderID, metaJSON, doc.DeletedAt, doc.HardDeleteAt, doc.CreatedAt, doc.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("repository.Create: %w", err)
	}
	return nil
}

func (r *DocumentRepo) GetByID(ctx context.Context, id string) (*model.Document, error) {
	doc := &model.Document{}
	var indexStatus, deletionStatus string
	var metaJSON []byte

	err := r.pool.QueryRow(ctx, `
		SELECT id, vault_id, user_id, filename, original_name, mime_type, file_type,
			size_bytes, storage_uri, storage_path, extracted_text, index_status,
			deletion_status, is_privileged, security_tier, chunk_count, checksum,
			folder_id, metadata, deleted_at, hard_delete_at, created_at, updated_at
		FROM documents WHERE id = $1`, id,
	).Scan(
		&doc.ID, &doc.VaultID, &doc.UserID, &doc.Filename, &doc.OriginalName, &doc.MimeType, &doc.FileType,
		&doc.SizeBytes, &doc.StorageURI, &doc.StoragePath, &doc.ExtractedText, &indexStatus,
		&deletionStatus, &doc.IsPrivileged, &doc.SecurityTier, &doc.ChunkCount, &doc.Checksum,
		&doc.FolderID, &metaJSON, &doc.DeletedAt, &doc.HardDeleteAt, &doc.CreatedAt, &doc.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("repository.GetByID: %w", err)
	}

	doc.IndexStatus = model.IndexStatus(indexStatus)
	doc.DeletionStatus = model.DeletionStatus(deletionStatus)
	doc.Metadata = json.RawMessage(metaJSON)

	return doc, nil
}

func (r *DocumentRepo) ListByUser(ctx context.Context, userID string, opts service.ListOpts) ([]model.Document, int, error) {
	// Count total
	var total int
	countQuery := `SELECT count(*) FROM documents WHERE user_id = $1 AND deletion_status = 'Active'`
	args := []interface{}{userID}

	if !opts.PrivilegeMode {
		countQuery += ` AND is_privileged = false`
	}

	err := r.pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("repository.ListByUser: count: %w", err)
	}

	// Fetch page
	limit := opts.Limit
	if limit <= 0 {
		limit = 20
	}

	listQuery := `
		SELECT id, vault_id, user_id, filename, original_name, mime_type, file_type,
			size_bytes, storage_uri, storage_path, index_status,
			deletion_status, is_privileged, security_tier, chunk_count,
			folder_id, created_at, updated_at
		FROM documents WHERE user_id = $1 AND deletion_status = 'Active'`

	if !opts.PrivilegeMode {
		listQuery += ` AND is_privileged = false`
	}

	listQuery += ` ORDER BY created_at DESC LIMIT $2 OFFSET $3`

	rows, err := r.pool.Query(ctx, listQuery, userID, limit, opts.Offset)
	if err != nil {
		return nil, 0, fmt.Errorf("repository.ListByUser: query: %w", err)
	}
	defer rows.Close()

	var docs []model.Document
	for rows.Next() {
		var d model.Document
		var indexStatus, deletionStatus string

		err := rows.Scan(
			&d.ID, &d.VaultID, &d.UserID, &d.Filename, &d.OriginalName, &d.MimeType, &d.FileType,
			&d.SizeBytes, &d.StorageURI, &d.StoragePath, &indexStatus,
			&deletionStatus, &d.IsPrivileged, &d.SecurityTier, &d.ChunkCount,
			&d.FolderID, &d.CreatedAt, &d.UpdatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("repository.ListByUser: scan: %w", err)
		}
		d.IndexStatus = model.IndexStatus(indexStatus)
		d.DeletionStatus = model.DeletionStatus(deletionStatus)
		docs = append(docs, d)
	}

	return docs, total, nil
}

func (r *DocumentRepo) UpdateStatus(ctx context.Context, id string, status model.IndexStatus) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE documents SET index_status = $1, updated_at = $2 WHERE id = $3`,
		string(status), time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("repository.UpdateStatus: %w", err)
	}
	return nil
}

func (r *DocumentRepo) UpdateText(ctx context.Context, id string, text string, pageCount int) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE documents SET extracted_text = $1, metadata = jsonb_set(COALESCE(metadata, '{}'), '{page_count}', to_jsonb($2::int)), updated_at = $3 WHERE id = $4`,
		text, pageCount, time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("repository.UpdateText: %w", err)
	}
	return nil
}

func (r *DocumentRepo) UpdateChunkCount(ctx context.Context, id string, count int) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE documents SET chunk_count = $1, updated_at = $2 WHERE id = $3`,
		count, time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("repository.UpdateChunkCount: %w", err)
	}
	return nil
}

func (r *DocumentRepo) SoftDelete(ctx context.Context, id string) error {
	now := time.Now().UTC()
	_, err := r.pool.Exec(ctx,
		`UPDATE documents SET deletion_status = 'SoftDeleted', deleted_at = $1, updated_at = $2 WHERE id = $3`,
		now, now, id,
	)
	if err != nil {
		return fmt.Errorf("repository.SoftDelete: %w", err)
	}
	return nil
}

func (r *DocumentRepo) Recover(ctx context.Context, id string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE documents SET deletion_status = 'Active', deleted_at = NULL, hard_delete_at = NULL, updated_at = $1 WHERE id = $2`,
		time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("repository.Recover: %w", err)
	}
	return nil
}

func (r *DocumentRepo) UpdateTier(ctx context.Context, id string, tier int) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE documents SET security_tier = $1, updated_at = $2 WHERE id = $3`,
		tier, time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("repository.UpdateTier: %w", err)
	}
	return nil
}

func (r *DocumentRepo) TogglePrivilege(ctx context.Context, id string, privileged bool) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE documents SET is_privileged = $1, updated_at = $2 WHERE id = $3`,
		privileged, time.Now().UTC(), id,
	)
	if err != nil {
		return fmt.Errorf("repository.TogglePrivilege: %w", err)
	}
	return nil
}

func marshalMeta(meta json.RawMessage) ([]byte, error) {
	if meta == nil {
		return nil, nil
	}
	return []byte(meta), nil
}
