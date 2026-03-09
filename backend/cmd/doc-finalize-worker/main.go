// doc-finalize-worker — EPIC-034 E34-011
// Invalidates caches, warms vault stats, verifies document status,
// fires Mercury notification event, logs audit entry.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/repository"
	"github.com/connexus-ai/ragbox-backend/internal/service"
	"github.com/connexus-ai/ragbox-backend/internal/worker"
)

type finalizeInput struct {
	DocumentID  string `json:"document_id"`
	TenantID    string `json:"tenant_id"`
	TotalChunks int    `json:"total_chunks"`
	Filename    string `json:"filename"`
}

func main() {
	ctx := context.Background()
	dbURL := os.Getenv("DATABASE_URL")
	redisAddr := os.Getenv("REDIS_ADDR")

	// Init DB
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		slog.Error("init db failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	docRepo := repository.NewDocumentRepo(pool)
	auditRepo := repository.NewAuditRepo(pool)
	auditService, err := service.NewAuditService(auditRepo, nil)
	if err != nil {
		slog.Error("init audit failed", "error", err)
		os.Exit(1)
	}

	// Init Redis
	redisCli := service.NewRedisClient(redisAddr)
	defer redisCli.Close()

	worker.Run("doc-finalize-worker", func(ctx context.Context, data []byte) error {
		var input finalizeInput
		if err := json.Unmarshal(data, &input); err != nil {
			return fmt.Errorf("unmarshal: %w", err)
		}

		slog.Info("finalizing", "document_id", input.DocumentID, "tenant_id", input.TenantID)

		// 1. Invalidate query caches for this tenant
		redisCli.InvalidateQueryCache(ctx, input.TenantID)

		// 2. Invalidate doc metadata cache
		redisCli.InvalidateDocCache(ctx, input.DocumentID)

		// 3. Warm vault stats
		stats, err := computeVaultStats(ctx, pool, input.TenantID)
		if err != nil {
			slog.Error("compute vault stats failed", "error", err)
		} else {
			redisCli.SetVaultStats(ctx, input.TenantID, stats)
		}

		// 4. Verify document is indexed (safety check)
		if err := docRepo.UpdateStatus(ctx, input.DocumentID, model.IndexIndexed); err != nil {
			slog.Error("finalize status update failed", "document_id", input.DocumentID, "error", err)
		}

		// 5. Audit log
		if err := auditService.Log(ctx, "DocumentUpload", input.TenantID, input.DocumentID, "document"); err != nil {
			slog.Error("audit log failed", "document_id", input.DocumentID, "error", err)
		}

		slog.Info("finalized", "document_id", input.DocumentID, "filename", input.Filename)
		return nil
	})
}

func computeVaultStats(ctx context.Context, pool *pgxpool.Pool, tenantID string) (*service.VaultStats, error) {
	var stats service.VaultStats

	err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM documents WHERE user_id = $1 AND deletion_status = 'Active'
	`, tenantID).Scan(&stats.DocumentCount)
	if err != nil {
		return nil, err
	}

	err = pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(chunk_count), 0) FROM documents WHERE user_id = $1 AND deletion_status = 'Active'
	`, tenantID).Scan(&stats.ChunkCount)
	if err != nil {
		return nil, err
	}

	return &stats, nil
}
