package repository

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	pgvector "github.com/pgvector/pgvector-go"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// ChunkRepo implements service.ChunkStore and service.VectorSearcher.
type ChunkRepo struct {
	pool *pgxpool.Pool
}

// NewChunkRepo creates a ChunkRepo.
func NewChunkRepo(pool *pgxpool.Pool) *ChunkRepo {
	return &ChunkRepo{pool: pool}
}

// Compile-time checks.
var (
	_ service.ChunkStore     = (*ChunkRepo)(nil)
	_ service.VectorSearcher = (*ChunkRepo)(nil)
)

// BulkInsert stores chunks with their embedding vectors using pgx batching.
func (r *ChunkRepo) BulkInsert(ctx context.Context, chunks []service.Chunk, vectors [][]float32) error {
	if len(chunks) == 0 {
		return nil
	}
	if len(chunks) != len(vectors) {
		return fmt.Errorf("repository.BulkInsert: chunk count (%d) != vector count (%d)", len(chunks), len(vectors))
	}

	batch := &pgx.Batch{}
	now := time.Now().UTC()

	for i, c := range chunks {
		id := uuid.New().String()
		embedding := pgvector.NewVector(vectors[i])

		batch.Queue(`
			INSERT INTO document_chunks (id, document_id, chunk_index, content, content_hash, token_count, embedding, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
			id, c.DocumentID, c.Index, c.Content, c.ContentHash, c.TokenCount, embedding, now,
		)
	}

	br := r.pool.SendBatch(ctx, batch)
	defer br.Close()

	for i := 0; i < len(chunks); i++ {
		_, err := br.Exec()
		if err != nil {
			return fmt.Errorf("repository.BulkInsert: chunk %d: %w", i, err)
		}
	}

	return nil
}

// SimilaritySearch finds the top-K chunks most similar to queryVec using cosine distance,
// scoped to documents owned by userID. When excludePrivileged is true, chunks from
// privileged documents are excluded.
func (r *ChunkRepo) SimilaritySearch(ctx context.Context, queryVec []float32, topK int, threshold float64, userID string, excludePrivileged bool) ([]service.VectorSearchResult, error) {
	embedding := pgvector.NewVector(queryVec)

	query := `
		SELECT
			dc.id, dc.document_id, dc.chunk_index, dc.content, dc.content_hash,
			dc.token_count, dc.created_at,
			1 - (dc.embedding <=> $1::vector) AS similarity,
			d.id, d.user_id, d.filename, d.original_name, d.mime_type, d.file_type,
			d.is_privileged, d.security_tier, d.chunk_count, d.created_at
		FROM document_chunks dc
		JOIN documents d ON dc.document_id = d.id
		WHERE d.deletion_status = 'Active'
			AND d.user_id = $3
			AND (1 - (dc.embedding <=> $1::vector)) > $2`

	if excludePrivileged {
		query += ` AND d.is_privileged = false`
	}

	query += `
		ORDER BY dc.embedding <=> $1::vector
		LIMIT $4`

	slog.Info("[DEBUG-REPO] executing similarity search",
		"top_k", topK,
		"threshold", threshold,
		"user_id", userID,
		"exclude_privileged", excludePrivileged,
	)

	rows, err := r.pool.Query(ctx, query, embedding, threshold, userID, topK)
	if err != nil {
		slog.Error("[DEBUG-REPO] similarity search query failed", "error", err)
		return nil, fmt.Errorf("repository.SimilaritySearch: %w", err)
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
			return nil, fmt.Errorf("repository.SimilaritySearch: scan: %w", err)
		}
		results = append(results, cr)
	}

	slog.Info("[DEBUG-REPO] similarity search complete",
		"results_count", len(results),
		"threshold", threshold,
		"top_k", topK,
	)

	return results, nil
}

// DeleteByDocumentID removes all chunks for a document.
// Used by: document re-indexing (planned), integration tests.
func (r *ChunkRepo) DeleteByDocumentID(ctx context.Context, documentID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM document_chunks WHERE document_id = $1`, documentID)
	if err != nil {
		return fmt.Errorf("repository.DeleteByDocumentID: %w", err)
	}
	return nil
}

// CountByDocumentID returns the number of chunks for a document.
// Used by: document detail endpoint (planned), integration tests.
func (r *ChunkRepo) CountByDocumentID(ctx context.Context, documentID string) (int, error) {
	var count int
	err := r.pool.QueryRow(ctx, `SELECT count(*) FROM document_chunks WHERE document_id = $1`, documentID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("repository.CountByDocumentID: %w", err)
	}
	return count, nil
}
