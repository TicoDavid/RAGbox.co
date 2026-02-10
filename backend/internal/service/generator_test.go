package service

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// mockGenAIClient implements GenAIClient for testing.
type mockGenAIClient struct {
	response string
	err      error
}

func (m *mockGenAIClient) GenerateContent(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	if m.err != nil {
		return "", m.err
	}
	return m.response, nil
}

func testChunks() []RankedChunk {
	return []RankedChunk{
		{
			Chunk:      model.DocumentChunk{ID: "chunk-1", DocumentID: "doc-1", Content: "The contract expires on March 2025."},
			Similarity: 0.95,
			FinalScore: 0.90,
			Document:   model.Document{ID: "doc-1", Filename: "contract.pdf"},
		},
		{
			Chunk:      model.DocumentChunk{ID: "chunk-2", DocumentID: "doc-2", Content: "Revenue was $5M in Q4."},
			Similarity: 0.88,
			FinalScore: 0.82,
			Document:   model.Document{ID: "doc-2", Filename: "financials.pdf"},
		},
	}
}

func TestGenerate_Success(t *testing.T) {
	client := &mockGenAIClient{
		response: `{"answer": "The contract expires in March 2025 [1]. Revenue was $5M [2].", "citations": [{"chunkIndex": 1, "excerpt": "expires on March 2025", "relevance": 0.95}, {"chunkIndex": 2, "excerpt": "Revenue was $5M", "relevance": 0.88}], "confidence": 0.92}`,
	}
	svc := NewGeneratorService(client, "gemini-1.5-pro")
	chunks := testChunks()

	result, err := svc.Generate(context.Background(), "When does the contract expire?", chunks, GenerateOpts{Mode: "concise"})
	if err != nil {
		t.Fatalf("Generate() error: %v", err)
	}

	if result.Answer == "" {
		t.Error("expected non-empty answer")
	}
	if len(result.Citations) != 2 {
		t.Errorf("citations count = %d, want 2", len(result.Citations))
	}
	if result.Confidence < 0.9 {
		t.Errorf("confidence = %f, want >= 0.9", result.Confidence)
	}
	if result.ModelUsed != "gemini-1.5-pro" {
		t.Errorf("ModelUsed = %q, want %q", result.ModelUsed, "gemini-1.5-pro")
	}
	if result.LatencyMs < 0 {
		t.Errorf("LatencyMs = %d, want >= 0", result.LatencyMs)
	}
}

func TestGenerate_CitationMapping(t *testing.T) {
	client := &mockGenAIClient{
		response: `{"answer": "Answer [1].", "citations": [{"chunkIndex": 1, "excerpt": "the excerpt", "relevance": 0.9}], "confidence": 0.85}`,
	}
	svc := NewGeneratorService(client, "gemini-1.5-pro")
	chunks := testChunks()

	result, err := svc.Generate(context.Background(), "query", chunks, GenerateOpts{})
	if err != nil {
		t.Fatalf("Generate() error: %v", err)
	}

	if len(result.Citations) != 1 {
		t.Fatalf("citations = %d, want 1", len(result.Citations))
	}

	cit := result.Citations[0]
	if cit.ChunkID != "chunk-1" {
		t.Errorf("ChunkID = %q, want %q", cit.ChunkID, "chunk-1")
	}
	if cit.DocumentID != "doc-1" {
		t.Errorf("DocumentID = %q, want %q", cit.DocumentID, "doc-1")
	}
	if cit.Index != 1 {
		t.Errorf("Index = %d, want 1", cit.Index)
	}
}

func TestGenerate_EmptyQuery(t *testing.T) {
	svc := NewGeneratorService(&mockGenAIClient{}, "model")

	_, err := svc.Generate(context.Background(), "", nil, GenerateOpts{})
	if err == nil {
		t.Fatal("expected error for empty query")
	}
}

func TestGenerate_ClientError(t *testing.T) {
	client := &mockGenAIClient{err: fmt.Errorf("Gemini rate limit")}
	svc := NewGeneratorService(client, "model")

	_, err := svc.Generate(context.Background(), "query", testChunks(), GenerateOpts{})
	if err == nil {
		t.Fatal("expected error when client fails")
	}
}

func TestGenerate_MalformedJSON(t *testing.T) {
	// Model returns plain text instead of JSON
	client := &mockGenAIClient{response: "The contract expires next year."}
	svc := NewGeneratorService(client, "model")

	result, err := svc.Generate(context.Background(), "query", testChunks(), GenerateOpts{})
	if err != nil {
		t.Fatalf("Generate() should handle malformed JSON gracefully: %v", err)
	}

	if result.Answer != "The contract expires next year." {
		t.Errorf("answer = %q, want raw text", result.Answer)
	}
	if len(result.Citations) != 0 {
		t.Errorf("citations = %d, want 0 for malformed response", len(result.Citations))
	}
	if result.Confidence != 0.5 {
		t.Errorf("confidence = %f, want 0.5 (fallback)", result.Confidence)
	}
}

func TestGenerate_JSONWithCodeFences(t *testing.T) {
	client := &mockGenAIClient{
		response: "```json\n{\"answer\": \"fenced answer\", \"citations\": [], \"confidence\": 0.8}\n```",
	}
	svc := NewGeneratorService(client, "model")

	result, err := svc.Generate(context.Background(), "query", testChunks(), GenerateOpts{})
	if err != nil {
		t.Fatalf("Generate() error: %v", err)
	}

	if result.Answer != "fenced answer" {
		t.Errorf("answer = %q, want %q", result.Answer, "fenced answer")
	}
}

func TestGenerate_OutOfRangeCitation(t *testing.T) {
	// Citation references chunk index 5 but only 2 chunks provided
	client := &mockGenAIClient{
		response: `{"answer": "answer", "citations": [{"chunkIndex": 5, "excerpt": "bad", "relevance": 0.9}], "confidence": 0.7}`,
	}
	svc := NewGeneratorService(client, "model")

	result, err := svc.Generate(context.Background(), "query", testChunks(), GenerateOpts{})
	if err != nil {
		t.Fatalf("Generate() error: %v", err)
	}

	if len(result.Citations) != 0 {
		t.Errorf("citations = %d, want 0 (out-of-range filtered)", len(result.Citations))
	}
}

func TestGenerate_Modes(t *testing.T) {
	modes := []string{"concise", "detailed", "risk-analysis"}
	for _, mode := range modes {
		t.Run(mode, func(t *testing.T) {
			client := &mockGenAIClient{
				response: `{"answer": "mode test", "citations": [], "confidence": 0.8}`,
			}
			svc := NewGeneratorService(client, "model")

			result, err := svc.Generate(context.Background(), "query", testChunks(), GenerateOpts{Mode: mode})
			if err != nil {
				t.Fatalf("Generate(mode=%s) error: %v", mode, err)
			}
			if result.Answer != "mode test" {
				t.Errorf("answer = %q, want %q", result.Answer, "mode test")
			}
		})
	}
}

func TestBuildUserPrompt(t *testing.T) {
	chunks := testChunks()
	prompt := buildUserPrompt("What is the revenue?", chunks, "concise")

	if !strings.Contains(prompt, "[1]") {
		t.Error("prompt should contain chunk index [1]")
	}
	if !strings.Contains(prompt, "[2]") {
		t.Error("prompt should contain chunk index [2]")
	}
	if !strings.Contains(prompt, "What is the revenue?") {
		t.Error("prompt should contain the query")
	}
	if !strings.Contains(prompt, "CONCISE") {
		t.Error("prompt should contain mode instruction")
	}
}

func TestBuildUserPrompt_DetailedMode(t *testing.T) {
	prompt := buildUserPrompt("query", testChunks(), "detailed")
	if !strings.Contains(prompt, "DETAILED") {
		t.Error("prompt should contain DETAILED for detailed mode")
	}
}

func TestBuildUserPrompt_RiskMode(t *testing.T) {
	prompt := buildUserPrompt("query", testChunks(), "risk-analysis")
	if !strings.Contains(prompt, "RISK ANALYSIS") {
		t.Error("prompt should contain RISK ANALYSIS for risk mode")
	}
}

func TestParseGenerationResponse_ValidJSON(t *testing.T) {
	raw := `{"answer": "test answer", "citations": [{"chunkIndex": 1, "excerpt": "ex", "relevance": 0.9}], "confidence": 0.88}`
	chunks := testChunks()

	result, err := parseGenerationResponse(raw, chunks)
	if err != nil {
		t.Fatalf("parseGenerationResponse() error: %v", err)
	}

	if result.Answer != "test answer" {
		t.Errorf("answer = %q, want %q", result.Answer, "test answer")
	}
	if result.Confidence != 0.88 {
		t.Errorf("confidence = %f, want 0.88", result.Confidence)
	}
}

func TestParseGenerationResponse_ZeroConfidenceWithCitations(t *testing.T) {
	raw := `{"answer": "answer", "citations": [{"chunkIndex": 1, "excerpt": "ex", "relevance": 0.9}], "confidence": 0}`
	chunks := testChunks()

	result, _ := parseGenerationResponse(raw, chunks)
	if result.Confidence <= 0 {
		t.Errorf("confidence should be estimated from citations, got %f", result.Confidence)
	}
}
