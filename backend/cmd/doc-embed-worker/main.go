// doc-embed-worker — EPIC-034 E34-009
// Embeds enriched chunks via Vertex AI, stores in pgvector,
// tracks completion via Redis counter, publishes to doc-finalize when done.
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"

	"cloud.google.com/go/pubsub"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/connexus-ai/ragbox-backend/internal/gcpclient"
	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/repository"
	"github.com/connexus-ai/ragbox-backend/internal/service"
	"github.com/connexus-ai/ragbox-backend/internal/worker"
)

type embedInput struct {
	DocumentID      string                    `json:"document_id"`
	TenantID        string                    `json:"tenant_id"`
	ChunkText       string                    `json:"chunk_text"`
	ChunkIndex      int                       `json:"chunk_index"`
	TokenCount      int                       `json:"token_count"`
	PositionStart   int                       `json:"position_start"`
	PositionEnd     int                       `json:"position_end"`
	PageNumber      int                       `json:"page_number"`
	ContextualText  string                    `json:"contextual_text"`
	Entities        []service.EntityExtracted `json:"entities"`
	DocumentType    string                    `json:"document_type"`
	KeyReferences   []string                  `json:"key_references"`
	EnrichmentModel string                    `json:"enrichment_model"`
	Filename        string                    `json:"filename"`
	TotalChunks     int                       `json:"total_chunks"`
}

type finalizeMsg struct {
	DocumentID  string `json:"document_id"`
	TenantID    string `json:"tenant_id"`
	TotalChunks int    `json:"total_chunks"`
	Filename    string `json:"filename"`
}

func main() {
	ctx := context.Background()
	project := os.Getenv("GOOGLE_CLOUD_PROJECT")
	dbURL := os.Getenv("DATABASE_URL")
	redisAddr := os.Getenv("REDIS_ADDR")
	embeddingLocation := os.Getenv("VERTEX_AI_EMBEDDING_LOCATION")
	if embeddingLocation == "" {
		embeddingLocation = "us-east4"
	}
	embeddingModel := os.Getenv("VERTEX_AI_EMBEDDING_MODEL")
	if embeddingModel == "" {
		embeddingModel = "text-embedding-004"
	}

	// Init DB
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		slog.Error("init db failed", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	chunkRepo := repository.NewChunkRepo(pool)
	docRepo := repository.NewDocumentRepo(pool)

	// Init embedding client
	embeddingAdapter, err := gcpclient.NewEmbeddingAdapter(ctx, project, embeddingLocation, embeddingModel)
	if err != nil {
		slog.Error("init embedding failed", "error", err)
		os.Exit(1)
	}
	embedder := service.NewEmbedderService(embeddingAdapter, chunkRepo)

	// Init Redis for progress tracking
	redisCli := service.NewRedisClient(redisAddr)
	defer redisCli.Close()

	// Init Pub/Sub
	psClient, err := pubsub.NewClient(ctx, project)
	if err != nil {
		slog.Error("init pubsub failed", "error", err)
		os.Exit(1)
	}
	defer psClient.Close()
	finalizePublisher := worker.NewPublisher(psClient, "doc-finalize")
	defer finalizePublisher.Close()

	worker.Run("doc-embed-worker", func(ctx context.Context, data []byte) error {
		var input embedInput
		if err := json.Unmarshal(data, &input); err != nil {
			return fmt.Errorf("unmarshal: %w", err)
		}

		slog.Info("embedding", "document_id", input.DocumentID, "chunk_index", input.ChunkIndex)

		// Build embedding input: contextual_text + chunk_text
		embeddingInput := input.ChunkText
		if input.ContextualText != "" {
			embeddingInput = input.ContextualText + "\n\n" + input.ChunkText
		}

		// Create chunk for embedder
		hash := sha256.Sum256([]byte(input.ChunkText))
		chunk := service.Chunk{
			Content:     embeddingInput,
			ContentHash: hex.EncodeToString(hash[:]),
			TokenCount:  input.TokenCount,
			Index:       input.ChunkIndex,
			DocumentID:  input.DocumentID,
			PageNumber:  input.PageNumber,
		}

		if err := embedder.EmbedAndStore(ctx, []service.Chunk{chunk}); err != nil {
			return fmt.Errorf("embed %s chunk %d: %w", input.DocumentID, input.ChunkIndex, err)
		}

		// Track completion via Redis
		count, err := redisCli.IncrEmbedProgress(ctx, input.DocumentID)
		if err != nil {
			slog.Error("redis incr failed", "document_id", input.DocumentID, "error", err)
		}

		slog.Info("embedded", "document_id", input.DocumentID, "chunk_index", input.ChunkIndex,
			"progress", fmt.Sprintf("%d/%d", count, input.TotalChunks))

		// All chunks embedded — finalize
		if count >= int64(input.TotalChunks) {
			if err := docRepo.UpdateStatus(ctx, input.DocumentID, model.IndexIndexed); err != nil {
				slog.Error("update status failed", "document_id", input.DocumentID, "error", err)
			}
			if err := docRepo.UpdateChunkCount(ctx, input.DocumentID, input.TotalChunks); err != nil {
				slog.Error("update chunk count failed", "document_id", input.DocumentID, "error", err)
			}

			if err := finalizePublisher.Publish(ctx, finalizeMsg{
				DocumentID:  input.DocumentID,
				TenantID:    input.TenantID,
				TotalChunks: input.TotalChunks,
				Filename:    input.Filename,
			}); err != nil {
				slog.Error("publish finalize failed", "document_id", input.DocumentID, "error", err)
			}

			slog.Info("all chunks embedded", "document_id", input.DocumentID, "total", input.TotalChunks)
		}

		return nil
	})
}
