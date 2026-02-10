package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// GenAIClient abstracts the Vertex AI Gemini generative model for testability.
type GenAIClient interface {
	GenerateContent(ctx context.Context, systemPrompt string, userPrompt string) (string, error)
}

// GenerateOpts configures a generation call.
type GenerateOpts struct {
	Mode       string // "concise", "detailed", "risk-analysis"
	Persona    string // persona key (e.g. "persona_cfo", "persona_legal")
	StrictMode bool   // if true, compliance layer is added
}

// GenerationResult is the output of a single generation call.
type GenerationResult struct {
	Answer     string        `json:"answer"`
	Citations  []CitationRef `json:"citations"`
	Confidence float64       `json:"confidence"`
	ModelUsed  string        `json:"modelUsed"`
	LatencyMs  int64         `json:"latencyMs"`
}

// CitationRef maps an inline citation to a source chunk.
type CitationRef struct {
	ChunkID    string  `json:"chunkId"`
	DocumentID string  `json:"documentId"`
	Excerpt    string  `json:"excerpt"`
	Relevance  float64 `json:"relevance"`
	Index      int     `json:"index"` // 1-based citation number
}

// SystemPromptBuilder abstracts the prompt assembly layer for testability.
type SystemPromptBuilder interface {
	BuildSystemPrompt(persona string, strictMode bool) string
}

// GeneratorService produces grounded answers from Gemini using retrieved context.
type GeneratorService struct {
	client       GenAIClient
	model        string
	promptLoader SystemPromptBuilder // nil until wired via SetPromptLoader
}

// NewGeneratorService creates a GeneratorService.
func NewGeneratorService(client GenAIClient, model string) *GeneratorService {
	return &GeneratorService{
		client: client,
		model:  model,
	}
}

// SetPromptLoader attaches a SystemPromptBuilder (called during server wiring).
func (s *GeneratorService) SetPromptLoader(pl SystemPromptBuilder) {
	s.promptLoader = pl
}

// Generate produces a cited answer for a query using retrieved chunks as context.
func (s *GeneratorService) Generate(ctx context.Context, query string, chunks []RankedChunk, opts GenerateOpts) (*GenerationResult, error) {
	if query == "" {
		return nil, fmt.Errorf("service.Generate: query is empty")
	}

	start := time.Now()

	systemPrompt := s.buildSystemPrompt(opts)
	userPrompt := buildUserPrompt(query, chunks, opts.Mode)

	raw, err := s.client.GenerateContent(ctx, systemPrompt, userPrompt)
	if err != nil {
		return nil, fmt.Errorf("service.Generate: %w", err)
	}

	result, err := parseGenerationResponse(raw, chunks)
	if err != nil {
		return nil, fmt.Errorf("service.Generate: parse: %w", err)
	}

	result.ModelUsed = s.model
	result.LatencyMs = time.Since(start).Milliseconds()

	return result, nil
}

// buildSystemPrompt assembles the system prompt using the PromptLoader if available.
func (s *GeneratorService) buildSystemPrompt(opts GenerateOpts) string {
	if s.promptLoader != nil {
		return s.promptLoader.BuildSystemPrompt(opts.Persona, opts.StrictMode)
	}
	// Fallback system prompt when no PromptLoader is configured
	return defaultSystemPrompt
}

const defaultSystemPrompt = `You are Mercury, a document intelligence assistant.
Rules:
- Only use provided context to answer. Never speculate.
- Cite sources as [1], [2], [3] referencing the chunk indices.
- Every factual claim must have a citation.
- If information is insufficient, say so explicitly.
- Return your response as JSON with the following structure:
{"answer": "...", "citations": [{"chunkIndex": 1, "excerpt": "...", "relevance": 0.9}], "confidence": 0.85}`

// buildUserPrompt constructs the user message with context chunks and query.
func buildUserPrompt(query string, chunks []RankedChunk, mode string) string {
	var sb strings.Builder

	sb.WriteString("=== CONTEXT CHUNKS ===\n")
	for i, c := range chunks {
		sb.WriteString(fmt.Sprintf("[%d] (doc: %s, score: %.2f)\n%s\n\n",
			i+1, c.Document.ID, c.Similarity, c.Chunk.Content))
	}

	sb.WriteString("=== QUERY ===\n")
	sb.WriteString(query)
	sb.WriteString("\n\n")

	switch mode {
	case "detailed":
		sb.WriteString("=== MODE: DETAILED ===\nProvide a comprehensive analysis with full citations.\n")
	case "risk-analysis":
		sb.WriteString("=== MODE: RISK ANALYSIS ===\nFocus on risks, exposures, and regulatory concerns. Quantify where possible.\n")
	default:
		sb.WriteString("=== MODE: CONCISE ===\nProvide a brief, focused answer with key citations.\n")
	}

	sb.WriteString("\nRespond with JSON: {\"answer\": \"...\", \"citations\": [{\"chunkIndex\": N, \"excerpt\": \"...\", \"relevance\": 0.0-1.0}], \"confidence\": 0.0-1.0}")

	return sb.String()
}

// generationJSON is the expected JSON structure from the model.
type generationJSON struct {
	Answer     string `json:"answer"`
	Confidence float64 `json:"confidence"`
	Citations  []struct {
		ChunkIndex int     `json:"chunkIndex"`
		Excerpt    string  `json:"excerpt"`
		Relevance  float64 `json:"relevance"`
	} `json:"citations"`
}

// parseGenerationResponse extracts structured data from the model's raw response.
func parseGenerationResponse(raw string, chunks []RankedChunk) (*GenerationResult, error) {
	// Strip markdown code fences if present
	cleaned := strings.TrimSpace(raw)
	if strings.HasPrefix(cleaned, "```") {
		lines := strings.Split(cleaned, "\n")
		// Remove first and last lines (code fences)
		if len(lines) >= 3 {
			cleaned = strings.Join(lines[1:len(lines)-1], "\n")
		}
	}
	cleaned = strings.TrimSpace(cleaned)

	var parsed generationJSON
	if err := json.Unmarshal([]byte(cleaned), &parsed); err != nil {
		// If JSON parsing fails, treat raw text as the answer with no citations
		return &GenerationResult{
			Answer:     raw,
			Citations:  []CitationRef{},
			Confidence: 0.5,
		}, nil
	}

	citations := make([]CitationRef, 0, len(parsed.Citations))
	for _, c := range parsed.Citations {
		idx := c.ChunkIndex
		if idx < 1 || idx > len(chunks) {
			continue // skip out-of-range citations
		}
		chunk := chunks[idx-1] // 1-based to 0-based
		citations = append(citations, CitationRef{
			ChunkID:    chunk.Chunk.ID,
			DocumentID: chunk.Document.ID,
			Excerpt:    c.Excerpt,
			Relevance:  c.Relevance,
			Index:      idx,
		})
	}

	confidence := parsed.Confidence
	if confidence <= 0 && len(citations) > 0 {
		// Estimate confidence from citation count
		confidence = float64(len(citations)) * 0.2
		if confidence > 1.0 {
			confidence = 1.0
		}
	}

	return &GenerationResult{
		Answer:     parsed.Answer,
		Citations:  citations,
		Confidence: confidence,
	}, nil
}
