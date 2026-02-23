package repository

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// BM25Repository implements service.BM25Searcher using PostgreSQL ts_vector.
// Relies on the GIN index on document_chunks.content_tsv created in STORY-161.
type BM25Repository struct {
	pool *pgxpool.Pool
}

// NewBM25Repository creates a BM25Repository.
func NewBM25Repository(pool *pgxpool.Pool) *BM25Repository {
	return &BM25Repository{pool: pool}
}

// Compile-time check.
var _ service.BM25Searcher = (*BM25Repository)(nil)

// FullTextSearch finds chunks matching the query via PostgreSQL full-text search,
// scoped to documents owned by userID. Uses the GIN index on content_tsv.
func (r *BM25Repository) FullTextSearch(ctx context.Context, query string, topK int, userID string) ([]service.VectorSearchResult, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT c.id, c.document_id, c.chunk_index, c.content, c.content_hash,
		       c.token_count, c.created_at,
		       ts_rank_cd(c.content_tsv, plainto_tsquery('english', $1)) AS rank,
		       d.id, d.user_id, d.filename, d.original_name, d.mime_type, d.file_type,
		       d.is_privileged, d.security_tier, d.chunk_count, d.created_at
		FROM document_chunks c
		JOIN documents d ON c.document_id = d.id
		WHERE d.user_id = $2
		  AND d.deletion_status = 'Active'
		  AND c.content_tsv @@ plainto_tsquery('english', $1)
		ORDER BY rank DESC
		LIMIT $3
	`, query, userID, topK)
	if err != nil {
		return nil, fmt.Errorf("repository.FullTextSearch: %w", err)
	}
	defer rows.Close()

	var results []service.VectorSearchResult
	for rows.Next() {
		var cr service.VectorSearchResult
		err := rows.Scan(
			&cr.Chunk.ID, &cr.Chunk.DocumentID, &cr.Chunk.ChunkIndex,
			&cr.Chunk.Content, &cr.Chunk.ContentHash, &cr.Chunk.TokenCount,
			&cr.Chunk.CreatedAt, &cr.Similarity,
			&cr.Document.ID, &cr.Document.UserID, &cr.Document.Filename,
			&cr.Document.OriginalName, &cr.Document.MimeType, &cr.Document.FileType,
			&cr.Document.IsPrivileged, &cr.Document.SecurityTier,
			&cr.Document.ChunkCount, &cr.Document.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("repository.FullTextSearch: scan: %w", err)
		}
		results = append(results, cr)
	}

	slog.Info("[DEBUG-REPO] bm25 full-text search complete",
		"results_count", len(results),
		"user_id", userID,
		"top_k", topK,
	)

	return results, nil
}
