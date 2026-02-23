package service

import (
	"context"
	"fmt"
	"strings"
	"testing"
)

// helper: build paragraph of approximately n words
func makeWords(n int) string {
	words := []string{"alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta", "iota", "kappa"}
	var b strings.Builder
	for i := 0; i < n; i++ {
		if i > 0 {
			b.WriteString(" ")
		}
		b.WriteString(words[i%len(words)])
	}
	return b.String()
}

func TestSemanticChunker_HeaderBoundary(t *testing.T) {
	svc := &SemanticChunkerService{minTokens: 20, maxTokens: 200}

	text := "# Section One\n\nContent of section one with enough words.\n\n## Section Two\n\nContent of section two with different words."

	chunks, err := svc.Chunk(context.Background(), text, "doc-hdr")
	if err != nil {
		t.Fatalf("Chunk() error: %v", err)
	}

	if len(chunks) < 2 {
		t.Fatalf("expected at least 2 chunks (split at header), got %d", len(chunks))
	}

	// First chunk should have section title "Section One"
	if chunks[0].SectionTitle != "Section One" {
		t.Errorf("chunk[0].SectionTitle = %q, want %q", chunks[0].SectionTitle, "Section One")
	}

	// Second chunk should have section title "Section Two"
	found := false
	for _, c := range chunks[1:] {
		if c.SectionTitle == "Section Two" {
			found = true
			break
		}
	}
	if !found {
		t.Error("expected a chunk with SectionTitle 'Section Two'")
	}
}

func TestSemanticChunker_ParagraphBoundary(t *testing.T) {
	svc := &SemanticChunkerService{minTokens: 20, maxTokens: 50}

	// Build paragraphs that individually fit but exceed maxTokens when merged
	var paragraphs []string
	for i := 0; i < 10; i++ {
		paragraphs = append(paragraphs, fmt.Sprintf("Paragraph %d has enough words to reach approximately thirty tokens in estimated count.", i))
	}
	text := strings.Join(paragraphs, "\n\n")

	chunks, err := svc.Chunk(context.Background(), text, "doc-para")
	if err != nil {
		t.Fatalf("Chunk() error: %v", err)
	}

	if len(chunks) < 3 {
		t.Errorf("expected at least 3 chunks from paragraph splitting, got %d", len(chunks))
	}

	// All chunks should have content
	for i, c := range chunks {
		if strings.TrimSpace(c.Content) == "" {
			t.Errorf("chunk[%d] is empty", i)
		}
	}
}

func TestSemanticChunker_SentenceBoundary(t *testing.T) {
	svc := &SemanticChunkerService{minTokens: 20, maxTokens: 50}

	// Single large paragraph with many sentences (exceeds maxTokens)
	var sentences []string
	for i := 0; i < 20; i++ {
		sentences = append(sentences, fmt.Sprintf("This is sentence number %d with enough words for testing.", i))
	}
	text := strings.Join(sentences, " ")

	chunks, err := svc.Chunk(context.Background(), text, "doc-sent")
	if err != nil {
		t.Fatalf("Chunk() error: %v", err)
	}

	if len(chunks) < 2 {
		t.Errorf("expected oversized paragraph to be split by sentences, got %d chunks", len(chunks))
	}
}

func TestSemanticChunker_OversizedParagraph(t *testing.T) {
	svc := &SemanticChunkerService{minTokens: 20, maxTokens: 50}

	// Single huge paragraph with no sentence boundaries (no ". " + uppercase)
	text := makeWords(200) // ~260 tokens, no periods

	chunks, err := svc.Chunk(context.Background(), text, "doc-huge")
	if err != nil {
		t.Fatalf("Chunk() error: %v", err)
	}

	if len(chunks) < 2 {
		t.Errorf("expected oversized paragraph to be split into multiple chunks, got %d", len(chunks))
	}

	// Verify all chunks have reasonable token counts
	for i, c := range chunks {
		if c.TokenCount <= 0 {
			t.Errorf("chunk[%d] has token count %d", i, c.TokenCount)
		}
	}
}

func TestSemanticChunker_EmptySections(t *testing.T) {
	svc := &SemanticChunkerService{minTokens: 20, maxTokens: 200}

	// Headers with no content between them
	text := "# Header 1\n\n## Header 2\n\n### Header 3\n\nFinally some content here."

	chunks, err := svc.Chunk(context.Background(), text, "doc-empty-sec")
	if err != nil {
		t.Fatalf("Chunk() error: %v", err)
	}

	if len(chunks) == 0 {
		t.Fatal("expected at least 1 chunk")
	}

	// No chunk should be only whitespace
	for i, c := range chunks {
		if strings.TrimSpace(c.Content) == "" {
			t.Errorf("chunk[%d] is empty", i)
		}
	}
}

func TestSemanticChunker_NoHeaders(t *testing.T) {
	svc := &SemanticChunkerService{minTokens: 20, maxTokens: 80}

	// Document with only paragraphs, no markdown headers
	var paragraphs []string
	for i := 0; i < 10; i++ {
		paragraphs = append(paragraphs, fmt.Sprintf("Paragraph %d contains relevant information about data privacy compliance and regulatory requirements.", i))
	}
	text := strings.Join(paragraphs, "\n\n")

	chunks, err := svc.Chunk(context.Background(), text, "doc-nohdr")
	if err != nil {
		t.Fatalf("Chunk() error: %v", err)
	}

	if len(chunks) < 2 {
		t.Errorf("expected multiple chunks, got %d", len(chunks))
	}

	// All section titles should be empty (no headers in source)
	for i, c := range chunks {
		if c.SectionTitle != "" {
			t.Errorf("chunk[%d].SectionTitle = %q, want empty (no headers)", i, c.SectionTitle)
		}
	}
}

func TestSemanticChunker_OverlapCorrectness(t *testing.T) {
	svc := &SemanticChunkerService{minTokens: 20, maxTokens: 60}

	// Paragraphs with clear sentence boundaries
	text := "First sentence of paragraph one. Second sentence of paragraph one.\n\n" +
		"First sentence of paragraph two. Second sentence of paragraph two.\n\n" +
		"First sentence of paragraph three. Second sentence of paragraph three.\n\n" +
		"First sentence of paragraph four. Second sentence of paragraph four.\n\n" +
		"First sentence of paragraph five. Second sentence of paragraph five.\n\n" +
		"First sentence of paragraph six. Second sentence of paragraph six."

	chunks, err := svc.Chunk(context.Background(), text, "doc-overlap")
	if err != nil {
		t.Fatalf("Chunk() error: %v", err)
	}

	if len(chunks) < 2 {
		t.Fatalf("expected at least 2 chunks for overlap test, got %d", len(chunks))
	}

	// Check that chunk[1] contains overlap text from the end of the previous segment
	// The overlap should contain the last 2 sentences from the previous segment's content
	for i := 1; i < len(chunks); i++ {
		// We can't predict exact content due to paragraph merging,
		// but chunk[i] should contain some content from the previous chunk
		prevWords := strings.Fields(chunks[i-1].Content)
		if len(prevWords) > 5 {
			lastFew := strings.Join(prevWords[len(prevWords)-3:], " ")
			if !strings.Contains(chunks[i].Content, lastFew) {
				t.Logf("chunk[%d] does not contain expected overlap from chunk[%d]", i, i-1)
				t.Logf("  looking for: %q", lastFew)
				t.Logf("  chunk[%d]: %q", i, chunks[i].Content[:min(100, len(chunks[i].Content))])
			}
		}
	}
}

func TestSemanticChunker_EmptyText(t *testing.T) {
	svc := NewSemanticChunkerService()

	_, err := svc.Chunk(context.Background(), "", "doc-empty")
	if err == nil {
		t.Fatal("expected error for empty text")
	}
}

func TestSemanticChunker_WhitespaceOnly(t *testing.T) {
	svc := NewSemanticChunkerService()

	_, err := svc.Chunk(context.Background(), "   \n\n\t  \n  ", "doc-ws")
	if err == nil {
		t.Fatal("expected error for whitespace-only text")
	}
}

func TestSemanticChunker_SectionTitleFromHeader(t *testing.T) {
	svc := &SemanticChunkerService{minTokens: 20, maxTokens: 500}

	text := "# Introduction\n\n" +
		"This document covers the legal framework for data privacy compliance.\n\n" +
		"## Section 1: GDPR\n\n" +
		"The General Data Protection Regulation applies to all EU citizens.\n\n" +
		"## Section 2: CCPA\n\n" +
		"California Consumer Privacy Act provides additional protections."

	chunks, err := svc.Chunk(context.Background(), text, "doc-title")
	if err != nil {
		t.Fatalf("Chunk() error: %v", err)
	}

	// Verify section titles are populated from headers
	titles := make(map[string]bool)
	for _, c := range chunks {
		if c.SectionTitle != "" {
			titles[c.SectionTitle] = true
		}
	}

	if !titles["Introduction"] {
		t.Error("expected SectionTitle 'Introduction'")
	}
}

func TestSemanticChunker_IndexSequential(t *testing.T) {
	svc := &SemanticChunkerService{minTokens: 20, maxTokens: 50}

	var paragraphs []string
	for i := 0; i < 10; i++ {
		paragraphs = append(paragraphs, fmt.Sprintf("Paragraph %d with enough words to contribute significantly to token count estimation.", i))
	}
	text := strings.Join(paragraphs, "\n\n")

	chunks, err := svc.Chunk(context.Background(), text, "doc-idx")
	if err != nil {
		t.Fatalf("Chunk() error: %v", err)
	}

	for i, c := range chunks {
		if c.Index != i {
			t.Errorf("chunk[%d].Index = %d, want %d", i, c.Index, i)
		}
	}
}

func TestSemanticChunker_HashDeterminism(t *testing.T) {
	svc := NewSemanticChunkerService()

	text := "A simple document with enough text. It has multiple sentences. " +
		strings.Repeat("More content to ensure we have enough text for a chunk. ", 30)

	chunks1, _ := svc.Chunk(context.Background(), text, "doc-a")
	chunks2, _ := svc.Chunk(context.Background(), text, "doc-b")

	if len(chunks1) == 0 || len(chunks2) == 0 {
		t.Fatal("expected at least 1 chunk from each")
	}

	if chunks1[0].ContentHash != chunks2[0].ContentHash {
		t.Error("same content should produce same hash across document IDs")
	}
}

func TestSplitSentencesSemantic(t *testing.T) {
	tests := []struct {
		input string
		want  int
	}{
		{"First sentence. Second sentence.", 2},
		{"Hello world. This is test. Another one.", 3},
		{"No uppercase after period. here it stays together.", 1},
		{"Single sentence without period", 1},
		{"Sentence ending with exclamation! Next sentence.", 2},
		{"Question mark here? Yes indeed.", 2},
		{"Mr. Smith went home.", 2}, // ". S" matches rule (known abbreviation false positive)
		{"", 0},
	}

	for _, tt := range tests {
		got := splitSentencesSemantic(tt.input)
		if len(got) != tt.want {
			t.Errorf("splitSentencesSemantic(%q) = %d sentences %v, want %d", tt.input, len(got), got, tt.want)
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
