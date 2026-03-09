// Sarah — EPIC-034 T4: Embed Worker Tests
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// ── Mocks ──────────────────────────────────────────────────────

type mockEmbedder struct {
	stored []service.Chunk
	err    error
}

func (m *mockEmbedder) EmbedAndStore(ctx context.Context, chunks []service.Chunk) error {
	m.stored = append(m.stored, chunks...)
	return m.err
}

type mockProgress struct {
	counts map[string]int64
	err    error
}

func (m *mockProgress) IncrEmbedProgress(ctx context.Context, documentID string) (int64, error) {
	if m.counts == nil {
		m.counts = make(map[string]int64)
	}
	m.counts[documentID]++
	return m.counts[documentID], m.err
}

type mockDocUpdater struct {
	statuses    []model.IndexStatus
	chunkCounts []int
	statusErr   error
	chunkErr    error
}

func (m *mockDocUpdater) UpdateStatus(ctx context.Context, id string, status model.IndexStatus) error {
	m.statuses = append(m.statuses, status)
	return m.statusErr
}

func (m *mockDocUpdater) UpdateChunkCount(ctx context.Context, id string, count int) error {
	m.chunkCounts = append(m.chunkCounts, count)
	return m.chunkErr
}

type mockPub struct {
	published []interface{}
	err       error
}

func (m *mockPub) Publish(ctx context.Context, data interface{}) error {
	m.published = append(m.published, data)
	return m.err
}

// ── Helpers ────────────────────────────────────────────────────

func makeEmbedInput(overrides ...func(*embedInput)) embedInput {
	in := embedInput{
		DocumentID:     "doc-001",
		TenantID:       "tenant-001",
		ChunkText:      "The parties agree to the payment terms.",
		ChunkIndex:     0,
		TokenCount:     40,
		PositionStart:  0,
		PositionEnd:    39,
		PageNumber:     1,
		ContextualText: "This chunk from a contract describes payment terms in Section 3.",
		Entities:       []service.EntityExtracted{{Name: "Acme", Type: "organization"}},
		DocumentType:   "contract",
		Filename:       "contract.pdf",
		TotalChunks:    5,
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

func TestProcessEmbed_ContextualTextConcatenation(t *testing.T) {
	embedder := &mockEmbedder{}
	progress := &mockProgress{}
	docRepo := &mockDocUpdater{}
	pub := &mockPub{}

	input := makeEmbedInput()
	err := processEmbed(context.Background(), marshal(t, input), embedder, progress, docRepo, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(embedder.stored) != 1 {
		t.Fatalf("expected 1 stored chunk, got %d", len(embedder.stored))
	}

	// Content should be contextual_text + "\n\n" + chunk_text
	expected := input.ContextualText + "\n\n" + input.ChunkText
	if embedder.stored[0].Content != expected {
		t.Errorf("embedded content = %q, want contextualText + chunk_text", embedder.stored[0].Content)
	}
}

func TestProcessEmbed_ChunkTextOnlyWhenNoContextual(t *testing.T) {
	embedder := &mockEmbedder{}
	progress := &mockProgress{}
	docRepo := &mockDocUpdater{}
	pub := &mockPub{}

	input := makeEmbedInput(func(in *embedInput) {
		in.ContextualText = ""
	})

	err := processEmbed(context.Background(), marshal(t, input), embedder, progress, docRepo, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if embedder.stored[0].Content != input.ChunkText {
		t.Errorf("expected chunk text only when contextual_text is empty, got %q", embedder.stored[0].Content)
	}
}

func TestProcessEmbed_StoresChunkWithAllFields(t *testing.T) {
	embedder := &mockEmbedder{}
	progress := &mockProgress{}
	docRepo := &mockDocUpdater{}
	pub := &mockPub{}

	input := makeEmbedInput()
	err := processEmbed(context.Background(), marshal(t, input), embedder, progress, docRepo, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	chunk := embedder.stored[0]
	if chunk.DocumentID != "doc-001" {
		t.Errorf("DocumentID = %q, want %q", chunk.DocumentID, "doc-001")
	}
	if chunk.Index != 0 {
		t.Errorf("Index = %d, want 0", chunk.Index)
	}
	if chunk.TokenCount != 40 {
		t.Errorf("TokenCount = %d, want 40", chunk.TokenCount)
	}
	if chunk.PageNumber != 1 {
		t.Errorf("PageNumber = %d, want 1", chunk.PageNumber)
	}
	if chunk.ContentHash == "" {
		t.Error("ContentHash should not be empty")
	}
}

func TestProcessEmbed_SHA256ContentHash(t *testing.T) {
	embedder := &mockEmbedder{}
	progress := &mockProgress{}
	docRepo := &mockDocUpdater{}
	pub := &mockPub{}

	input := makeEmbedInput()
	err := processEmbed(context.Background(), marshal(t, input), embedder, progress, docRepo, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	hash := embedder.stored[0].ContentHash
	if len(hash) != 64 { // SHA-256 hex is 64 chars
		t.Errorf("ContentHash length = %d, want 64 (SHA-256 hex)", len(hash))
	}
}

func TestProcessEmbed_TracksProgressViaRedis(t *testing.T) {
	embedder := &mockEmbedder{}
	progress := &mockProgress{}
	docRepo := &mockDocUpdater{}
	pub := &mockPub{}

	input := makeEmbedInput(func(in *embedInput) {
		in.TotalChunks = 10
	})

	err := processEmbed(context.Background(), marshal(t, input), embedder, progress, docRepo, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if progress.counts["doc-001"] != 1 {
		t.Errorf("progress count = %d, want 1", progress.counts["doc-001"])
	}
}

func TestProcessEmbed_PublishesFinalize_WhenAllChunksComplete(t *testing.T) {
	embedder := &mockEmbedder{}
	progress := &mockProgress{
		counts: map[string]int64{"doc-001": 4}, // will become 5 after incr
	}
	docRepo := &mockDocUpdater{}
	pub := &mockPub{}

	input := makeEmbedInput(func(in *embedInput) {
		in.TotalChunks = 5 // count will reach 5 (== TotalChunks)
	})

	err := processEmbed(context.Background(), marshal(t, input), embedder, progress, docRepo, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should publish finalize message
	if len(pub.published) != 1 {
		t.Fatalf("expected 1 finalize message, got %d", len(pub.published))
	}

	msg := pub.published[0].(finalizeMsg)
	if msg.DocumentID != "doc-001" {
		t.Errorf("finalize DocumentID = %q, want %q", msg.DocumentID, "doc-001")
	}
	if msg.TotalChunks != 5 {
		t.Errorf("finalize TotalChunks = %d, want 5", msg.TotalChunks)
	}

	// Should update status to Indexed
	if len(docRepo.statuses) == 0 || docRepo.statuses[0] != model.IndexIndexed {
		t.Error("expected UpdateStatus(Indexed) when all chunks complete")
	}

	// Should update chunk count
	if len(docRepo.chunkCounts) == 0 || docRepo.chunkCounts[0] != 5 {
		t.Errorf("expected UpdateChunkCount(5), got %v", docRepo.chunkCounts)
	}
}

func TestProcessEmbed_NoFinalize_PartialCompletion(t *testing.T) {
	embedder := &mockEmbedder{}
	progress := &mockProgress{} // starts at 0, will be 1 after incr
	docRepo := &mockDocUpdater{}
	pub := &mockPub{}

	input := makeEmbedInput(func(in *embedInput) {
		in.TotalChunks = 10
	})

	err := processEmbed(context.Background(), marshal(t, input), embedder, progress, docRepo, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(pub.published) != 0 {
		t.Errorf("should not publish finalize for partial completion, got %d messages", len(pub.published))
	}
	if len(docRepo.statuses) != 0 {
		t.Errorf("should not update status for partial completion")
	}
}

func TestProcessEmbed_EmbedFailure_ReturnsError(t *testing.T) {
	embedder := &mockEmbedder{err: fmt.Errorf("embedding API: 500 internal error")}
	progress := &mockProgress{}
	docRepo := &mockDocUpdater{}
	pub := &mockPub{}

	err := processEmbed(context.Background(), marshal(t, makeEmbedInput()), embedder, progress, docRepo, pub)
	if err == nil {
		t.Fatal("expected error when embedder fails")
	}
	if !strings.Contains(err.Error(), "embed") {
		t.Errorf("error should reference embed stage, got: %v", err)
	}
}

func TestProcessEmbed_InvalidJSON(t *testing.T) {
	embedder := &mockEmbedder{}
	progress := &mockProgress{}
	docRepo := &mockDocUpdater{}
	pub := &mockPub{}

	err := processEmbed(context.Background(), []byte("bad"), embedder, progress, docRepo, pub)
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}
