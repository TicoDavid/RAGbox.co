// Sarah — EPIC-034 T5: Graph Worker Tests
package main

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// ── Mocks ──────────────────────────────────────────────────────

type processCall struct {
	TenantID   string
	DocumentID string
	Filename   string
	DocType    string
	ChunkID    string
	Entities   []service.EntityExtracted
}

type mockGraphProcessor struct {
	calls []processCall
}

func (m *mockGraphProcessor) ProcessChunkEntities(ctx context.Context, tenantID, documentID, filename, docType, chunkID string, entities []service.EntityExtracted) {
	m.calls = append(m.calls, processCall{
		TenantID:   tenantID,
		DocumentID: documentID,
		Filename:   filename,
		DocType:    docType,
		ChunkID:    chunkID,
		Entities:   entities,
	})
}

// ── Helpers ────────────────────────────────────────────────────

func makeGraphInput(overrides ...func(*graphInput)) graphInput {
	in := graphInput{
		DocumentID:   "doc-001",
		TenantID:     "tenant-001",
		ChunkText:    "Acme Corp agrees to pay $50,000 to Widget Inc.",
		ChunkIndex:   0,
		ContextualText: "From a services agreement Section 3.",
		Entities: []service.EntityExtracted{
			{Name: "Acme Corp", Type: "organization", Role: "party", Section: "Section 3"},
			{Name: "Widget Inc", Type: "organization", Role: "counterparty", Section: "Section 3"},
			{Name: "$50,000", Type: "amount", Role: "contract_value", Section: "Section 3"},
		},
		DocumentType: "agreement",
		Filename:     "contract.pdf",
	}
	for _, f := range overrides {
		f(&in)
	}
	return in
}

func marshal(t *testing.T, v interface{}) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return b
}

// ── Tests ──────────────────────────────────────────────────────

func TestProcessGraph_CreatesEntitiesAndRelationships(t *testing.T) {
	graph := &mockGraphProcessor{}

	err := processGraph(context.Background(), marshal(t, makeGraphInput()), graph)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(graph.calls) != 1 {
		t.Fatalf("expected 1 ProcessChunkEntities call, got %d", len(graph.calls))
	}

	call := graph.calls[0]
	if call.TenantID != "tenant-001" {
		t.Errorf("TenantID = %q, want %q", call.TenantID, "tenant-001")
	}
	if call.DocumentID != "doc-001" {
		t.Errorf("DocumentID = %q, want %q", call.DocumentID, "doc-001")
	}
	if call.Filename != "contract.pdf" {
		t.Errorf("Filename = %q, want %q", call.Filename, "contract.pdf")
	}
	if call.DocType != "agreement" {
		t.Errorf("DocType = %q, want %q", call.DocType, "agreement")
	}
}

func TestProcessGraph_PassesCorrectEntities(t *testing.T) {
	graph := &mockGraphProcessor{}

	err := processGraph(context.Background(), marshal(t, makeGraphInput()), graph)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	entities := graph.calls[0].Entities
	if len(entities) != 3 {
		t.Fatalf("expected 3 entities, got %d", len(entities))
	}
	if entities[0].Name != "Acme Corp" {
		t.Errorf("entity[0].Name = %q, want %q", entities[0].Name, "Acme Corp")
	}
	if entities[1].Name != "Widget Inc" {
		t.Errorf("entity[1].Name = %q, want %q", entities[1].Name, "Widget Inc")
	}
	if entities[2].Type != "amount" {
		t.Errorf("entity[2].Type = %q, want %q", entities[2].Type, "amount")
	}
}

func TestProcessGraph_GeneratesChunkID(t *testing.T) {
	graph := &mockGraphProcessor{}

	err := processGraph(context.Background(), marshal(t, makeGraphInput()), graph)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	chunkID := graph.calls[0].ChunkID
	if chunkID == "" {
		t.Error("ChunkID should not be empty")
	}
	// UUID format: 8-4-4-4-12
	if len(chunkID) != 36 {
		t.Errorf("ChunkID length = %d, want 36 (UUID format)", len(chunkID))
	}
}

func TestProcessGraph_EmptyEntities_SkipsACK(t *testing.T) {
	graph := &mockGraphProcessor{}

	input := makeGraphInput(func(in *graphInput) {
		in.Entities = nil
	})

	err := processGraph(context.Background(), marshal(t, input), graph)
	if err != nil {
		t.Fatalf("expected nil error for empty entities (ACK), got: %v", err)
	}

	if len(graph.calls) != 0 {
		t.Errorf("should not call ProcessChunkEntities for empty entities, got %d calls", len(graph.calls))
	}
}

func TestProcessGraph_EmptyEntitiesSlice_SkipsACK(t *testing.T) {
	graph := &mockGraphProcessor{}

	input := makeGraphInput(func(in *graphInput) {
		in.Entities = []service.EntityExtracted{}
	})

	err := processGraph(context.Background(), marshal(t, input), graph)
	if err != nil {
		t.Fatalf("expected nil error for empty entities (ACK), got: %v", err)
	}

	if len(graph.calls) != 0 {
		t.Errorf("should not call ProcessChunkEntities for empty slice, got %d calls", len(graph.calls))
	}
}

func TestProcessGraph_SingleEntity(t *testing.T) {
	graph := &mockGraphProcessor{}

	input := makeGraphInput(func(in *graphInput) {
		in.Entities = []service.EntityExtracted{
			{Name: "John Doe", Type: "person", Role: "signatory", Section: "Signature"},
		}
	})

	err := processGraph(context.Background(), marshal(t, input), graph)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(graph.calls) != 1 {
		t.Fatalf("expected 1 call, got %d", len(graph.calls))
	}
	if len(graph.calls[0].Entities) != 1 {
		t.Errorf("expected 1 entity, got %d", len(graph.calls[0].Entities))
	}
}

func TestProcessGraph_CrossDocumentLinking_SameEntityName(t *testing.T) {
	graph := &mockGraphProcessor{}

	// Process two different documents with the same entity
	input1 := makeGraphInput(func(in *graphInput) {
		in.DocumentID = "doc-001"
		in.Entities = []service.EntityExtracted{
			{Name: "Acme Corp", Type: "organization"},
		}
	})
	input2 := makeGraphInput(func(in *graphInput) {
		in.DocumentID = "doc-002"
		in.Entities = []service.EntityExtracted{
			{Name: "Acme Corp", Type: "organization"},
		}
	})

	if err := processGraph(context.Background(), marshal(t, input1), graph); err != nil {
		t.Fatalf("doc-001: %v", err)
	}
	if err := processGraph(context.Background(), marshal(t, input2), graph); err != nil {
		t.Fatalf("doc-002: %v", err)
	}

	if len(graph.calls) != 2 {
		t.Fatalf("expected 2 calls (one per doc), got %d", len(graph.calls))
	}

	// Both calls have the same entity name — Neo4j MERGE ensures single node
	if graph.calls[0].Entities[0].Name != graph.calls[1].Entities[0].Name {
		t.Error("same entity should be passed to both calls for MERGE dedup")
	}
}

func TestProcessGraph_InvalidJSON(t *testing.T) {
	graph := &mockGraphProcessor{}

	err := processGraph(context.Background(), []byte("broken"), graph)
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestProcessGraph_UniqueChunkIDPerCall(t *testing.T) {
	graph := &mockGraphProcessor{}
	input := makeGraphInput()

	if err := processGraph(context.Background(), marshal(t, input), graph); err != nil {
		t.Fatalf("call 1: %v", err)
	}
	if err := processGraph(context.Background(), marshal(t, input), graph); err != nil {
		t.Fatalf("call 2: %v", err)
	}

	if len(graph.calls) != 2 {
		t.Fatalf("expected 2 calls, got %d", len(graph.calls))
	}
	if graph.calls[0].ChunkID == graph.calls[1].ChunkID {
		t.Error("each call should generate a unique chunkID")
	}
}
