// doc-enrich-worker — EPIC-034 E34-008 — THE INTELLIGENCE CORE
// One Gemini call per chunk: entity extraction + contextual enrichment.
// FAIL-OPEN: if Gemini errors, still publishes to doc-index without enrichment.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"

	"cloud.google.com/go/pubsub"

	"github.com/connexus-ai/ragbox-backend/internal/gcpclient"
	"github.com/connexus-ai/ragbox-backend/internal/service"
	"github.com/connexus-ai/ragbox-backend/internal/worker"
)

type enrichInput struct {
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

type enrichOutput struct {
	DocumentID      string                     `json:"document_id"`
	TenantID        string                     `json:"tenant_id"`
	ChunkText       string                     `json:"chunk_text"`
	ChunkIndex      int                        `json:"chunk_index"`
	TokenCount      int                        `json:"token_count"`
	PositionStart   int                        `json:"position_start"`
	PositionEnd     int                        `json:"position_end"`
	PageNumber      int                        `json:"page_number"`
	ContextualText  string                     `json:"contextual_text"`
	Entities        []service.EntityExtracted  `json:"entities"`
	DocumentType    string                     `json:"document_type"`
	KeyReferences   []string                   `json:"key_references"`
	EnrichmentModel string                     `json:"enrichment_model"`
	Filename        string                     `json:"filename"`
	TotalChunks     int                        `json:"total_chunks"`
}

// chunkEnricher abstracts Gemini enrichment for testability.
type chunkEnricher interface {
	Enrich(ctx context.Context, fullDocText, chunkText string, chunkIndex int) (*service.EnrichmentResult, error)
}

// messagePublisher abstracts Pub/Sub publishing for testability.
type messagePublisher interface {
	Publish(ctx context.Context, data interface{}) error
}

// processEnrich handles a single enrich message. FAIL-OPEN on Gemini error.
func processEnrich(ctx context.Context, data []byte, enricher chunkEnricher, pub messagePublisher, modelName string) error {
	var input enrichInput
	if err := json.Unmarshal(data, &input); err != nil {
		return fmt.Errorf("unmarshal: %w", err)
	}

	slog.Info("enriching", "document_id", input.DocumentID, "chunk_index", input.ChunkIndex)

	result, err := enricher.Enrich(ctx, input.FullDocumentText, input.ChunkText, input.ChunkIndex)
	enrichmentModel := modelName
	if err != nil || (result.ContextualText == "" && len(result.Entities) == 0) {
		enrichmentModel = "failed"
	}

	output := enrichOutput{
		DocumentID:      input.DocumentID,
		TenantID:        input.TenantID,
		ChunkText:       input.ChunkText,
		ChunkIndex:      input.ChunkIndex,
		TokenCount:      input.TokenCount,
		PositionStart:   input.PositionStart,
		PositionEnd:     input.PositionEnd,
		PageNumber:      input.PageNumber,
		ContextualText:  result.ContextualText,
		Entities:        result.Entities,
		DocumentType:    result.DocumentType,
		KeyReferences:   result.KeyReferences,
		EnrichmentModel: enrichmentModel,
		Filename:        input.Filename,
		TotalChunks:     input.TotalChunks,
	}

	if err := pub.Publish(ctx, output); err != nil {
		return fmt.Errorf("publish %s chunk %d: %w", input.DocumentID, input.ChunkIndex, err)
	}

	slog.Info("enriched", "document_id", input.DocumentID, "chunk_index", input.ChunkIndex,
		"entities", len(result.Entities), "model", enrichmentModel)
	return nil
}

func main() {
	ctx := context.Background()
	project := os.Getenv("GOOGLE_CLOUD_PROJECT")
	location := os.Getenv("VERTEX_AI_LOCATION")
	if location == "" {
		location = "us-east4"
	}
	model := "gemini-2.0-flash"

	// Init Gemini client
	genAI, err := gcpclient.NewGenAIAdapter(ctx, project, location, model)
	if err != nil {
		slog.Error("init genai failed", "error", err)
		os.Exit(1)
	}
	enricher := service.NewEnricherService(genAI, model)

	// Init Pub/Sub publisher
	psClient, err := pubsub.NewClient(ctx, project)
	if err != nil {
		slog.Error("init pubsub failed", "error", err)
		os.Exit(1)
	}
	defer psClient.Close()
	publisher := worker.NewPublisher(psClient, "doc-index")
	defer publisher.Close()

	worker.Run("doc-enrich-worker", func(ctx context.Context, data []byte) error {
		return processEnrich(ctx, data, enricher, publisher, model)
	})
}
