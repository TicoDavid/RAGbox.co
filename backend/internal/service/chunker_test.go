package service

import (
	"context"
	"strings"
	"testing"
)

func TestChunker_BasicChunking(t *testing.T) {
	svc := NewLegacyChunkerService(100, 0.20) // small chunk size for testing

	// Build text with enough content to produce multiple chunks
	var paragraphs []string
	for i := 0; i < 20; i++ {
		paragraphs = append(paragraphs, "This is a test paragraph with enough words to contribute to the token count. It has multiple sentences. Each sentence adds to the overall length of the paragraph.")
	}
	text := strings.Join(paragraphs, "\n\n")

	chunks, err := svc.Chunk(context.Background(), text, "doc-1")
	if err != nil {
		t.Fatalf("Chunk() error: %v", err)
	}

	if len(chunks) < 2 {
		t.Errorf("expected at least 2 chunks, got %d", len(chunks))
	}

	// Verify all chunks have required fields
	for i, c := range chunks {
		if c.Content == "" {
			t.Errorf("chunk[%d] has empty content", i)
		}
		if c.ContentHash == "" {
			t.Errorf("chunk[%d] has empty hash", i)
		}
		if c.TokenCount <= 0 {
			t.Errorf("chunk[%d] has token count %d", i, c.TokenCount)
		}
		if c.DocumentID != "doc-1" {
			t.Errorf("chunk[%d] DocumentID = %q, want %q", i, c.DocumentID, "doc-1")
		}
		if c.Index != i {
			t.Errorf("chunk[%d] Index = %d, want %d", i, c.Index, i)
		}
	}
}

func TestChunker_OverlapApplied(t *testing.T) {
	svc := NewLegacyChunkerService(50, 0.20) // very small chunks to force many splits

	var paragraphs []string
	for i := 0; i < 15; i++ {
		paragraphs = append(paragraphs, "Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon.")
	}
	text := strings.Join(paragraphs, "\n\n")

	chunks, err := svc.Chunk(context.Background(), text, "doc-overlap")
	if err != nil {
		t.Fatalf("Chunk() error: %v", err)
	}

	if len(chunks) < 3 {
		t.Fatalf("expected at least 3 chunks for overlap test, got %d", len(chunks))
	}

	// Check that chunk[1] contains some content from chunk[0] (overlap)
	words0 := strings.Fields(chunks[0].Content)
	if len(words0) > 5 {
		lastFew := strings.Join(words0[len(words0)-3:], " ")
		if !strings.Contains(chunks[1].Content, lastFew) {
			t.Errorf("chunk[1] should contain overlap from chunk[0], looking for %q in chunk[1]", lastFew)
		}
	}
}

func TestChunker_SHA256Hash(t *testing.T) {
	svc := NewLegacyChunkerService(768, 0.20)

	text := "This is a simple document with just enough text to form a single chunk."
	chunks, err := svc.Chunk(context.Background(), text, "doc-hash")
	if err != nil {
		t.Fatalf("Chunk() error: %v", err)
	}

	if len(chunks) == 0 {
		t.Fatal("expected at least 1 chunk")
	}

	// SHA-256 hash should be 64 hex chars
	if len(chunks[0].ContentHash) != 64 {
		t.Errorf("ContentHash length = %d, want 64", len(chunks[0].ContentHash))
	}

	// Same content should produce same hash
	chunks2, _ := svc.Chunk(context.Background(), text, "doc-hash-2")
	if chunks[0].ContentHash != chunks2[0].ContentHash {
		t.Error("same content should produce same hash")
	}
}

func TestChunker_EmptyText(t *testing.T) {
	svc := NewLegacyChunkerService(768, 0.20)

	_, err := svc.Chunk(context.Background(), "", "doc-empty")
	if err == nil {
		t.Fatal("expected error for empty text")
	}
}

func TestChunker_WhitespaceOnly(t *testing.T) {
	svc := NewLegacyChunkerService(768, 0.20)

	_, err := svc.Chunk(context.Background(), "   \n\n\t  \n  ", "doc-ws")
	if err == nil {
		t.Fatal("expected error for whitespace-only text")
	}
}

func TestChunker_SectionTitleExtraction(t *testing.T) {
	svc := NewLegacyChunkerService(768, 0.20)

	text := `# Introduction

This document covers the legal framework for data privacy compliance.

## Section 1: GDPR

The General Data Protection Regulation applies to all EU citizens.

## Section 2: CCPA

California Consumer Privacy Act provides additional protections.`

	chunks, err := svc.Chunk(context.Background(), text, "doc-sections")
	if err != nil {
		t.Fatalf("Chunk() error: %v", err)
	}

	if len(chunks) == 0 {
		t.Fatal("expected at least 1 chunk")
	}

	// At least one chunk should have a section title
	hasTitle := false
	for _, c := range chunks {
		if c.SectionTitle != "" {
			hasTitle = true
			break
		}
	}
	if !hasTitle {
		t.Error("expected at least one chunk to have a section title")
	}
}

func TestChunker_NoEmptyChunks(t *testing.T) {
	svc := NewLegacyChunkerService(100, 0.20)

	text := "First paragraph.\n\n\n\n\n\nSecond paragraph.\n\n\n\n\n\nThird paragraph."
	chunks, err := svc.Chunk(context.Background(), text, "doc-gaps")
	if err != nil {
		t.Fatalf("Chunk() error: %v", err)
	}

	for i, c := range chunks {
		if strings.TrimSpace(c.Content) == "" {
			t.Errorf("chunk[%d] is empty after trim", i)
		}
	}
}

func TestChunker_LargeParagraphSplit(t *testing.T) {
	svc := NewLegacyChunkerService(50, 0.20) // Very small chunk size

	// Single paragraph with many sentences
	var sentences []string
	for i := 0; i < 30; i++ {
		sentences = append(sentences, "This is sentence number that contains enough words to matter for token estimation.")
	}
	text := strings.Join(sentences, " ")

	chunks, err := svc.Chunk(context.Background(), text, "doc-large")
	if err != nil {
		t.Fatalf("Chunk() error: %v", err)
	}

	if len(chunks) < 2 {
		t.Errorf("expected large paragraph to be split into multiple chunks, got %d", len(chunks))
	}
}

func TestChunker_SingleParagraph(t *testing.T) {
	svc := NewLegacyChunkerService(768, 0.20)

	text := "A simple short paragraph that fits in one chunk."
	chunks, err := svc.Chunk(context.Background(), text, "doc-single")
	if err != nil {
		t.Fatalf("Chunk() error: %v", err)
	}

	if len(chunks) != 1 {
		t.Errorf("expected 1 chunk, got %d", len(chunks))
	}
	if chunks[0].Index != 0 {
		t.Errorf("Index = %d, want 0", chunks[0].Index)
	}
}

func TestChunker_DefaultParameters(t *testing.T) {
	// Test that invalid parameters get sensible defaults
	svc := NewLegacyChunkerService(0, -1)
	if svc.chunkSize != 768 {
		t.Errorf("chunkSize = %d, want 768 (default)", svc.chunkSize)
	}
	if svc.overlapPct != 0.20 {
		t.Errorf("overlapPct = %f, want 0.20 (default)", svc.overlapPct)
	}
}

func TestEstimateTokens(t *testing.T) {
	tests := []struct {
		text string
		min  int
		max  int
	}{
		{"", 0, 0},
		{"hello", 1, 3},
		{"one two three four five", 5, 10},
	}

	for _, tt := range tests {
		got := estimateTokens(tt.text)
		if got < tt.min || got > tt.max {
			t.Errorf("estimateTokens(%q) = %d, want [%d, %d]", tt.text, got, tt.min, tt.max)
		}
	}
}

func TestExtractSectionTitle(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"# Introduction", "Introduction"},
		{"## Section 1", "Section 1"},
		{"### Subsection", "Subsection"},
		{"Normal paragraph", ""},
		{"", ""},
	}

	for _, tt := range tests {
		got := extractSectionTitle(tt.input)
		if got != tt.want {
			t.Errorf("extractSectionTitle(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestSha256Hash(t *testing.T) {
	hash := sha256Hash("hello world")
	if len(hash) != 64 {
		t.Errorf("hash length = %d, want 64", len(hash))
	}
	// Deterministic
	if sha256Hash("hello world") != hash {
		t.Error("same input should produce same hash")
	}
	// Different input → different hash
	if sha256Hash("goodbye world") == hash {
		t.Error("different input should produce different hash")
	}
}
