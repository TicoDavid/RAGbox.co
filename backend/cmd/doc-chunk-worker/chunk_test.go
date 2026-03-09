// Sarah — EPIC-034 T2: Chunk Worker Tests
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// ── Mocks ──────────────────────────────────────────────────────

type mockChunker struct {
	chunks    []service.Chunk
	err       error
	calledText string
}

func (m *mockChunker) Chunk(ctx context.Context, text string, docID string) ([]service.Chunk, error) {
	m.calledText = text
	return m.chunks, m.err
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

func makeChunkInput(overrides ...func(*chunkInput)) chunkInput {
	in := chunkInput{
		DocumentID: "doc-001",
		TenantID:   "tenant-001",
		RawText:    "This is a long document with multiple paragraphs.\n\nSecond paragraph with more content.\n\nThird paragraph for good measure.",
		PageCount:  3,
		MimeType:   "application/pdf",
		Filename:   "contract.pdf",
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

func TestProcessChunk_ChunksAt500Tokens(t *testing.T) {
	chunker := &mockChunker{
		chunks: []service.Chunk{
			{Content: "Chunk 1 text here.", TokenCount: 450, Index: 0, PageNumber: 1},
			{Content: "Chunk 2 text here.", TokenCount: 480, Index: 1, PageNumber: 2},
		},
	}
	pub := &mockPub{}

	err := processChunk(context.Background(), marshal(t, makeChunkInput()), chunker, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for i, msg := range pub.published {
		output, ok := msg.(chunkOutput)
		if !ok {
			t.Fatalf("published[%d] is not chunkOutput", i)
		}
		if output.TokenCount > 500 {
			t.Errorf("chunk %d token count %d exceeds 500 max", i, output.TokenCount)
		}
	}
}

func TestProcessChunk_CorrectPositionOffsets(t *testing.T) {
	chunker := &mockChunker{
		chunks: []service.Chunk{
			{Content: "First chunk.", TokenCount: 100, Index: 0, PageNumber: 1},
			{Content: "Second chunk.", TokenCount: 120, Index: 1, PageNumber: 1},
			{Content: "Third chunk.", TokenCount: 110, Index: 2, PageNumber: 2},
		},
	}
	pub := &mockPub{}

	err := processChunk(context.Background(), marshal(t, makeChunkInput()), chunker, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(pub.published) != 3 {
		t.Fatalf("expected 3 messages, got %d", len(pub.published))
	}

	out0 := pub.published[0].(chunkOutput)
	out1 := pub.published[1].(chunkOutput)
	out2 := pub.published[2].(chunkOutput)

	// First chunk starts at 0
	if out0.PositionStart != 0 {
		t.Errorf("chunk 0 PositionStart = %d, want 0", out0.PositionStart)
	}
	if out0.PositionEnd != len("First chunk.") {
		t.Errorf("chunk 0 PositionEnd = %d, want %d", out0.PositionEnd, len("First chunk."))
	}

	// Second chunk starts where first ended
	if out1.PositionStart != out0.PositionEnd {
		t.Errorf("chunk 1 PositionStart = %d, want %d (end of chunk 0)", out1.PositionStart, out0.PositionEnd)
	}

	// Third chunk starts where second ended
	if out2.PositionStart != out1.PositionEnd {
		t.Errorf("chunk 2 PositionStart = %d, want %d (end of chunk 1)", out2.PositionStart, out1.PositionEnd)
	}
}

func TestProcessChunk_CorrectPageNumbers(t *testing.T) {
	chunker := &mockChunker{
		chunks: []service.Chunk{
			{Content: "Page 1 content.", TokenCount: 100, Index: 0, PageNumber: 1},
			{Content: "Page 3 content.", TokenCount: 100, Index: 1, PageNumber: 3},
		},
	}
	pub := &mockPub{}

	err := processChunk(context.Background(), marshal(t, makeChunkInput()), chunker, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	out0 := pub.published[0].(chunkOutput)
	out1 := pub.published[1].(chunkOutput)

	if out0.PageNumber != 1 {
		t.Errorf("chunk 0 PageNumber = %d, want 1", out0.PageNumber)
	}
	if out1.PageNumber != 3 {
		t.Errorf("chunk 1 PageNumber = %d, want 3", out1.PageNumber)
	}
}

func TestProcessChunk_PublishesOneMessagePerChunk(t *testing.T) {
	chunker := &mockChunker{
		chunks: []service.Chunk{
			{Content: "A", TokenCount: 10, Index: 0},
			{Content: "B", TokenCount: 10, Index: 1},
			{Content: "C", TokenCount: 10, Index: 2},
			{Content: "D", TokenCount: 10, Index: 3},
		},
	}
	pub := &mockPub{}

	err := processChunk(context.Background(), marshal(t, makeChunkInput()), chunker, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(pub.published) != 4 {
		t.Errorf("expected 4 published messages (one per chunk), got %d", len(pub.published))
	}
}

func TestProcessChunk_EachMessageIncludesFullDocumentText(t *testing.T) {
	chunker := &mockChunker{
		chunks: []service.Chunk{
			{Content: "Chunk 1.", TokenCount: 50, Index: 0},
			{Content: "Chunk 2.", TokenCount: 50, Index: 1},
		},
	}
	pub := &mockPub{}
	input := makeChunkInput()

	err := processChunk(context.Background(), marshal(t, input), chunker, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for i, msg := range pub.published {
		output := msg.(chunkOutput)
		if output.FullDocumentText != input.RawText {
			t.Errorf("chunk %d FullDocumentText does not match original RawText", i)
		}
	}
}

func TestProcessChunk_EmptyDocument(t *testing.T) {
	chunker := &mockChunker{
		err: fmt.Errorf("service.Chunk: text is empty"),
	}
	pub := &mockPub{}
	input := makeChunkInput(func(in *chunkInput) {
		in.RawText = ""
	})

	err := processChunk(context.Background(), marshal(t, input), chunker, pub)
	if err == nil {
		t.Fatal("expected error for empty document")
	}
	if len(pub.published) != 0 {
		t.Errorf("should not publish for empty document, got %d messages", len(pub.published))
	}
}

func TestProcessChunk_ShortDocument_SingleChunk(t *testing.T) {
	chunker := &mockChunker{
		chunks: []service.Chunk{
			{Content: "Short document.", TokenCount: 10, Index: 0, PageNumber: 1},
		},
	}
	pub := &mockPub{}
	input := makeChunkInput(func(in *chunkInput) {
		in.RawText = "Short document."
	})

	err := processChunk(context.Background(), marshal(t, input), chunker, pub)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(pub.published) != 1 {
		t.Fatalf("expected 1 published message for short doc, got %d", len(pub.published))
	}

	output := pub.published[0].(chunkOutput)
	if output.TotalChunks != 1 {
		t.Errorf("TotalChunks = %d, want 1", output.TotalChunks)
	}
}

func TestProcessChunk_InvalidJSON(t *testing.T) {
	chunker := &mockChunker{}
	pub := &mockPub{}

	err := processChunk(context.Background(), []byte("not json"), chunker, pub)
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}
