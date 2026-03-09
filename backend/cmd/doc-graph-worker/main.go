// doc-graph-worker — EPIC-034 E34-010
// Receives enriched chunks, creates/updates Neo4j entity nodes,
// document nodes, APPEARS_IN and RELATED_TO relationships.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"

	"github.com/google/uuid"

	"github.com/connexus-ai/ragbox-backend/internal/service"
	"github.com/connexus-ai/ragbox-backend/internal/worker"
)

type graphInput struct {
	DocumentID      string                    `json:"document_id"`
	TenantID        string                    `json:"tenant_id"`
	ChunkText       string                    `json:"chunk_text"`
	ChunkIndex      int                       `json:"chunk_index"`
	ContextualText  string                    `json:"contextual_text"`
	Entities        []service.EntityExtracted `json:"entities"`
	DocumentType    string                    `json:"document_type"`
	Filename        string                    `json:"filename"`
}

func main() {
	ctx := context.Background()
	neo4jURI := os.Getenv("NEO4J_URL")
	neo4jUser := os.Getenv("NEO4J_USERNAME")
	if neo4jUser == "" {
		neo4jUser = "neo4j"
	}
	neo4jPass := os.Getenv("NEO4J_PASSWORD")

	neo4jClient, err := service.NewNeo4jClient(neo4jURI, neo4jUser, neo4jPass)
	if err != nil {
		slog.Error("init neo4j failed", "error", err)
		os.Exit(1)
	}
	defer neo4jClient.Close(ctx)

	worker.Run("doc-graph-worker", func(ctx context.Context, data []byte) error {
		var input graphInput
		if err := json.Unmarshal(data, &input); err != nil {
			return fmt.Errorf("unmarshal: %w", err)
		}

		if len(input.Entities) == 0 {
			slog.Info("no entities, skipping", "document_id", input.DocumentID, "chunk_index", input.ChunkIndex)
			return nil // ACK — nothing to graph
		}

		chunkID := uuid.New().String()

		slog.Info("graphing", "document_id", input.DocumentID, "chunk_index", input.ChunkIndex,
			"entities", len(input.Entities))

		neo4jClient.ProcessChunkEntities(ctx, input.TenantID, input.DocumentID,
			input.Filename, input.DocumentType, chunkID, input.Entities)

		slog.Info("graphed", "document_id", input.DocumentID, "chunk_index", input.ChunkIndex)
		return nil
	})
}
