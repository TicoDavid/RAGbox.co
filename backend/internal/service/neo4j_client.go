package service

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// Neo4jClient wraps the Neo4j driver for knowledge graph operations.
type Neo4jClient struct {
	driver neo4j.DriverWithContext
}

// NewNeo4jClient creates a Neo4j client from a bolt connection URI.
func NewNeo4jClient(uri, username, password string) (*Neo4jClient, error) {
	driver, err := neo4j.NewDriverWithContext(uri, neo4j.BasicAuth(username, password, ""))
	if err != nil {
		return nil, fmt.Errorf("neo4j.NewDriverWithContext: %w", err)
	}
	return &Neo4jClient{driver: driver}, nil
}

// Close shuts down the Neo4j driver.
func (c *Neo4jClient) Close(ctx context.Context) error {
	return c.driver.Close(ctx)
}

// MergeEntity creates or updates an entity node (idempotent).
func (c *Neo4jClient) MergeEntity(ctx context.Context, tenantID, name, entityType string) (string, error) {
	session := c.driver.NewSession(ctx, neo4j.SessionConfig{DatabaseName: "neo4j"})
	defer session.Close(ctx)

	entityID := uuid.New().String()

	result, err := session.Run(ctx, `
		MERGE (e:Entity {name: $name, type: $type, tenant_id: $tenant_id})
		ON CREATE SET e.id = $uuid, e.first_seen = datetime(), e.last_seen = datetime(),
		              e.document_count = 1, e.chunk_count = 1
		ON MATCH SET e.last_seen = datetime(),
		             e.chunk_count = e.chunk_count + 1
		RETURN e.id AS id
	`, map[string]interface{}{
		"name":      name,
		"type":      entityType,
		"tenant_id": tenantID,
		"uuid":      entityID,
	})
	if err != nil {
		return "", fmt.Errorf("neo4j.MergeEntity: %w", err)
	}

	if result.Next(ctx) {
		if id, ok := result.Record().Get("id"); ok {
			return id.(string), nil
		}
	}
	return entityID, nil
}

// MergeDocument creates or updates a document node.
func (c *Neo4jClient) MergeDocument(ctx context.Context, tenantID, documentID, filename, docType string) error {
	session := c.driver.NewSession(ctx, neo4j.SessionConfig{DatabaseName: "neo4j"})
	defer session.Close(ctx)

	_, err := session.Run(ctx, `
		MERGE (d:Document {id: $document_id, tenant_id: $tenant_id})
		ON CREATE SET d.name = $filename, d.type = $document_type,
		              d.uploaded_at = datetime(), d.chunk_count = 0, d.entity_count = 0
		SET d.chunk_count = d.chunk_count + 1
	`, map[string]interface{}{
		"document_id":   documentID,
		"tenant_id":     tenantID,
		"filename":      filename,
		"document_type": docType,
	})
	if err != nil {
		return fmt.Errorf("neo4j.MergeDocument: %w", err)
	}
	return nil
}

// CreateAppearsIn creates an APPEARS_IN relationship between an entity and document.
func (c *Neo4jClient) CreateAppearsIn(ctx context.Context, tenantID, entityName, entityType, documentID, chunkID, role, section string) error {
	session := c.driver.NewSession(ctx, neo4j.SessionConfig{DatabaseName: "neo4j"})
	defer session.Close(ctx)

	_, err := session.Run(ctx, `
		MATCH (e:Entity {name: $name, type: $type, tenant_id: $tenant_id})
		MATCH (d:Document {id: $document_id})
		MERGE (e)-[r:APPEARS_IN {chunk_id: $chunk_id}]->(d)
		SET r.role = $role, r.section = $section
	`, map[string]interface{}{
		"name":        entityName,
		"type":        entityType,
		"tenant_id":   tenantID,
		"document_id": documentID,
		"chunk_id":    chunkID,
		"role":        role,
		"section":     section,
	})
	if err != nil {
		return fmt.Errorf("neo4j.CreateAppearsIn: %w", err)
	}
	return nil
}

// CreateRelatedTo creates a RELATED_TO relationship between co-occurring entities.
func (c *Neo4jClient) CreateRelatedTo(ctx context.Context, tenantID, name1, type1, name2, type2, documentID string) error {
	session := c.driver.NewSession(ctx, neo4j.SessionConfig{DatabaseName: "neo4j"})
	defer session.Close(ctx)

	_, err := session.Run(ctx, `
		MATCH (e1:Entity {name: $name1, type: $type1, tenant_id: $tenant_id})
		MATCH (e2:Entity {name: $name2, type: $type2, tenant_id: $tenant_id})
		WHERE e1 <> e2
		MERGE (e1)-[r:RELATED_TO {document_id: $document_id}]->(e2)
	`, map[string]interface{}{
		"name1":       name1,
		"type1":       type1,
		"name2":       name2,
		"type2":       type2,
		"tenant_id":   tenantID,
		"document_id": documentID,
	})
	if err != nil {
		return fmt.Errorf("neo4j.CreateRelatedTo: %w", err)
	}
	return nil
}

// ProcessChunkEntities handles the full graph ingestion for one enriched chunk.
func (c *Neo4jClient) ProcessChunkEntities(ctx context.Context, tenantID, documentID, filename, docType, chunkID string, entities []EntityExtracted) {
	// Merge document node
	if err := c.MergeDocument(ctx, tenantID, documentID, filename, docType); err != nil {
		slog.Error("neo4j: merge document failed", "document_id", documentID, "error", err)
	}

	// Merge each entity and create APPEARS_IN relationships
	for _, ent := range entities {
		if _, err := c.MergeEntity(ctx, tenantID, ent.Name, ent.Type); err != nil {
			slog.Error("neo4j: merge entity failed", "entity", ent.Name, "error", err)
			continue
		}
		if err := c.CreateAppearsIn(ctx, tenantID, ent.Name, ent.Type, documentID, chunkID, ent.Role, ent.Section); err != nil {
			slog.Error("neo4j: create appears_in failed", "entity", ent.Name, "error", err)
		}
	}

	// Create RELATED_TO for co-occurring entity pairs
	for i := 0; i < len(entities); i++ {
		for j := i + 1; j < len(entities); j++ {
			if err := c.CreateRelatedTo(ctx, tenantID, entities[i].Name, entities[i].Type, entities[j].Name, entities[j].Type, documentID); err != nil {
				slog.Error("neo4j: create related_to failed", "e1", entities[i].Name, "e2", entities[j].Name, "error", err)
			}
		}
	}
}
