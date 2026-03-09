// doc-chunk-worker — EPIC-034 E34-007
// Receives raw text, chunks via SemanticChunkerService (500 tokens, 15% overlap),
// publishes one message per chunk to doc-enrich topic.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"

	"cloud.google.com/go/pubsub"

	"github.com/connexus-ai/ragbox-backend/internal/service"
	"github.com/connexus-ai/ragbox-backend/internal/worker"
)

type chunkInput struct {
	DocumentID string `json:"document_id"`
	TenantID   string `json:"tenant_id"`
	RawText    string `json:"raw_text"`
	PageCount  int    `json:"page_count"`
	MimeType   string `json:"mime_type"`
	Filename   string `json:"filename"`
}

type chunkOutput struct {
	DocumentID       string `json:"document_id"`
	TenantID         string `json:"tenant_id"`
	ChunkText        string `json:"chunk_text"`
	ChunkIndex       int    `json:"chunk_index"`
	TokenCount       int    `json:"token_count"`
	PositionStart    int    `json:"position_start"`
	PositionEnd      int    `json:"position_end"`
	PageNumber       int    `json:"page_number"`
	FullDocumentText string `json:"full_document_text"`
	Filename         string `json:"filename"`
	TotalChunks      int    `json:"total_chunks"`
}

// textChunker abstracts semantic chunking for testability.
type textChunker interface {
	Chunk(ctx context.Context, text string, docID string) ([]service.Chunk, error)
}

// messagePublisher abstracts Pub/Sub publishing for testability.
type messagePublisher interface {
	Publish(ctx context.Context, data interface{}) error
}

// processChunk handles a single chunk message.
func processChunk(ctx context.Context, data []byte, chunker textChunker, pub messagePublisher) error {
	var input chunkInput
	if err := json.Unmarshal(data, &input); err != nil {
		return fmt.Errorf("unmarshal: %w", err)
	}

	slog.Info("chunking", "document_id", input.DocumentID, "text_len", len(input.RawText))

	chunks, err := chunker.Chunk(ctx, input.RawText, input.DocumentID)
	if err != nil {
		return fmt.Errorf("chunk %s: %w", input.DocumentID, err)
	}

	// Truncate full document text for enrichment context.
	// Sending the complete text with every chunk message wastes bandwidth and bloats
	// Gemini prompts, causing rate-limit failures on large documents (C2 cert fix).
	// 4000 chars ≈ 1000 tokens — enough context for entity extraction + classification.
	contextText := input.RawText
	const maxContextChars = 4000
	if len(contextText) > maxContextChars {
		contextText = contextText[:maxContextChars]
	}

	// Compute character positions for each chunk
	position := 0
	for i, chunk := range chunks {
		start := position
		end := start + len(chunk.Content)

		output := chunkOutput{
			DocumentID:       input.DocumentID,
			TenantID:         input.TenantID,
			ChunkText:        chunk.Content,
			ChunkIndex:       i,
			TokenCount:       chunk.TokenCount,
			PositionStart:    start,
			PositionEnd:      end,
			PageNumber:       chunk.PageNumber,
			FullDocumentText: contextText,
			Filename:         input.Filename,
			TotalChunks:      len(chunks),
		}

		if err := pub.Publish(ctx, output); err != nil {
			return fmt.Errorf("publish chunk %d of %s: %w", i, input.DocumentID, err)
		}
		position = end
	}

	slog.Info("chunked", "document_id", input.DocumentID, "chunks", len(chunks))
	return nil
}

func main() {
	ctx := context.Background()
	project := os.Getenv("GOOGLE_CLOUD_PROJECT")

	// EPIC-034: 500 tokens, 15% overlap ≈ 3 sentences
	chunker := service.NewSemanticChunkerServiceWithConfig(400, 500, 3)

	// Init Pub/Sub publisher
	psClient, err := pubsub.NewClient(ctx, project)
	if err != nil {
		slog.Error("init pubsub failed", "error", err)
		os.Exit(1)
	}
	defer psClient.Close()
	publisher := worker.NewPublisher(psClient, "doc-enrich")
	defer publisher.Close()

	worker.Run("doc-chunk-worker", func(ctx context.Context, data []byte) error {
		return processChunk(ctx, data, chunker, publisher)
	})
}
