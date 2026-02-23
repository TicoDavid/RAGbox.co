package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// GenAIClient abstracts the Vertex AI Gemini generative model for testability.
type GenAIClient interface {
	GenerateContent(ctx context.Context, systemPrompt string, userPrompt string) (string, error)
}

// StreamingGenAIClient extends GenAIClient with streaming support.
type StreamingGenAIClient interface {
	GenAIClient
	GenerateContentStream(ctx context.Context, systemPrompt, userPrompt string) (<-chan string, <-chan error)
}

// StreamResult provides live token streaming with deferred full-text access.
type StreamResult struct {
	TokenCh <-chan string  // live tokens for SSE
	Full    func() string  // call after TokenCh closes to get full text
	ErrCh   <-chan error
	Model   string         // model name for metadata
}

// GenerateOpts configures a generation call.
type GenerateOpts struct {
	Mode           string                // "concise", "detailed", "risk-analysis"
	Persona        string                // persona key (e.g. "persona_cfo", "persona_legal")
	StrictMode     bool                  // if true, compliance layer is added
	DynamicPersona *model.MercuryPersona // if set, overrides file-based Persona lookup
	CortexContext  []string              // recent conversation context (informational, no citations)
	Instructions   []string              // standing user instructions
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
	Rules() string
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

// PromptLoader returns the current SystemPromptBuilder (may be nil).
func (s *GeneratorService) PromptLoader() SystemPromptBuilder {
	return s.promptLoader
}

// Generate produces a cited answer for a query using retrieved chunks as context.
func (s *GeneratorService) Generate(ctx context.Context, query string, chunks []RankedChunk, opts GenerateOpts) (*GenerationResult, error) {
	if query == "" {
		return nil, fmt.Errorf("service.Generate: query is empty")
	}

	start := time.Now()

	// Persona-specific mode defaults: legal and auditor default to detailed
	mode := opts.Mode
	if mode == "" {
		switch opts.Persona {
		case "legal", "persona_legal", "auditor", "persona_auditor":
			mode = "detailed"
		}
	}

	systemPrompt := s.buildSystemPrompt(opts)
	userPrompt := buildUserPrompt(query, chunks, mode, opts.CortexContext...)

	raw, err := s.client.GenerateContent(ctx, systemPrompt, userPrompt)
	if err != nil {
		return nil, fmt.Errorf("service.Generate: %w", err)
	}

	result, err := ParseGenerationResponse(raw, chunks)
	if err != nil {
		return nil, fmt.Errorf("service.Generate: parse: %w", err)
	}

	result.ModelUsed = s.model
	result.LatencyMs = time.Since(start).Milliseconds()

	return result, nil
}

// GenerateStream produces a streaming generation if the underlying client supports it.
// Falls back to Generate + synthetic single-chunk delivery if the client does not
// implement StreamingGenAIClient (e.g., test mocks, BYOLLM clients).
func (s *GeneratorService) GenerateStream(ctx context.Context, query string, chunks []RankedChunk, opts GenerateOpts) (*StreamResult, error) {
	if query == "" {
		return nil, fmt.Errorf("service.GenerateStream: query is empty")
	}

	streamClient, ok := s.client.(StreamingGenAIClient)
	if !ok {
		// Fallback: non-streaming client — generate synchronously, deliver as one chunk
		raw, err := s.client.GenerateContent(ctx, s.buildSystemPrompt(opts),
			buildUserPrompt(query, chunks, opts.Mode, opts.CortexContext...))
		if err != nil {
			return nil, fmt.Errorf("service.GenerateStream: fallback: %w", err)
		}
		ch := make(chan string, 1)
		errCh := make(chan error, 1)
		ch <- raw
		close(ch)
		close(errCh)
		return &StreamResult{
			TokenCh: ch,
			Full:    func() string { return raw },
			ErrCh:   errCh,
			Model:   s.model,
		}, nil
	}

	// Build prompts (same logic as Generate)
	mode := opts.Mode
	if mode == "" {
		switch opts.Persona {
		case "legal", "persona_legal", "auditor", "persona_auditor":
			mode = "detailed"
		}
	}

	systemPrompt := s.buildSystemPrompt(opts)
	userPrompt := buildUserPrompt(query, chunks, mode, opts.CortexContext...)

	textCh, errCh := streamClient.GenerateContentStream(ctx, systemPrompt, userPrompt)

	var accumulated strings.Builder
	proxyCh := make(chan string, 64)

	go func() {
		defer close(proxyCh)
		for token := range textCh {
			accumulated.WriteString(token)
			proxyCh <- token
		}
	}()

	return &StreamResult{
		TokenCh: proxyCh,
		Full:    func() string { return accumulated.String() },
		ErrCh:   errCh,
		Model:   s.model,
	}, nil
}

// buildSystemPrompt assembles the system prompt using the PromptLoader if available.
// If a DynamicPersona is provided (from the DB), it overrides the file-based persona.
func (s *GeneratorService) buildSystemPrompt(opts GenerateOpts) string {
	var base string
	if opts.DynamicPersona != nil {
		base = s.buildDynamicPrompt(opts.DynamicPersona, opts.StrictMode)
	} else if s.promptLoader != nil {
		base = s.promptLoader.BuildSystemPrompt(opts.Persona, opts.StrictMode)
	} else {
		base = defaultSystemPrompt
	}

	// Append standing instructions from cortex
	if len(opts.Instructions) > 0 {
		var sb strings.Builder
		sb.WriteString(base)
		sb.WriteString("\n\n=== STANDING INSTRUCTIONS FROM USER ===\n")
		for _, instr := range opts.Instructions {
			sb.WriteString("- ")
			sb.WriteString(instr)
			sb.WriteString("\n")
		}
		return sb.String()
	}

	return base
}

// buildDynamicPrompt constructs a system prompt from a DB-stored MercuryPersona.
// Layer 1: Rules Engine (from PromptLoader), Layer 2: Dynamic persona, Layer 3: Compliance (if strict).
func (s *GeneratorService) buildDynamicPrompt(persona *model.MercuryPersona, strictMode bool) string {
	var sb strings.Builder

	// Layer 1: Rules Engine (always present)
	if s.promptLoader != nil {
		sb.WriteString("=== RULES (NON-NEGOTIABLE) ===\n")
		sb.WriteString(s.promptLoader.Rules())
	} else {
		sb.WriteString(defaultSystemPrompt)
	}

	// Layer 2: Dynamic persona (replaces static mercury_identity.txt)
	sb.WriteString("\n\n=== ACTIVE PERSONA ===\n")
	title := "AI Assistant"
	if persona.Title != nil {
		title = *persona.Title
	}
	sb.WriteString(fmt.Sprintf("You are %s, %s.\n\n", persona.FullName(), title))
	sb.WriteString("PERSONALITY & COMMUNICATION STYLE:\n")
	sb.WriteString(persona.PersonalityPrompt)
	sb.WriteString("\n\n")
	sb.WriteString(fmt.Sprintf("SILENCE PROTOCOL THRESHOLD: %.2f — If your confidence in an answer is below this threshold, "+
		"decline to answer rather than speculate. Say you need to check the vault.\n", persona.SilenceHighThreshold))

	// Channel rules
	if len(persona.ChannelConfig) > 0 && string(persona.ChannelConfig) != "{}" && string(persona.ChannelConfig) != "null" {
		sb.WriteString("\nCHANNEL-SPECIFIC RULES:\n")
		sb.WriteString(string(persona.ChannelConfig))
		sb.WriteString("\n")
	}

	// Email signature
	if persona.SignatureBlock != nil && *persona.SignatureBlock != "" {
		sb.WriteString("\nEMAIL SIGNATURE (use when sending emails):\n")
		sb.WriteString(*persona.SignatureBlock)
		sb.WriteString("\n")
	}

	// Layer 3: Compliance (optional)
	if strictMode && s.promptLoader != nil {
		compliancePrompt := s.promptLoader.BuildSystemPrompt("compliance_strict", true)
		// BuildSystemPrompt with strictMode appends the compliance block
		// Extract it by finding the compliance section
		if idx := strings.Index(compliancePrompt, "=== COMPLIANCE MODE ==="); idx >= 0 {
			sb.WriteString("\n\n")
			sb.WriteString(compliancePrompt[idx:])
		}
	}

	return sb.String()
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
func buildUserPrompt(query string, chunks []RankedChunk, mode string, cortexContext ...string) string {
	var sb strings.Builder

	sb.WriteString("=== CONTEXT CHUNKS ===\n")
	for i, c := range chunks {
		sb.WriteString(fmt.Sprintf("[%d] (doc: %s, score: %.2f)\n%s\n\n",
			i+1, c.Document.ID, c.Similarity, c.Chunk.Content))
	}

	// Cortex context: recent conversation memory (informational, NOT cited)
	if len(cortexContext) > 0 {
		sb.WriteString("=== RECENT CONTEXT (from past conversations — do NOT cite these, use for context only) ===\n")
		for _, ctx := range cortexContext {
			sb.WriteString("- ")
			sb.WriteString(ctx)
			sb.WriteString("\n")
		}
		sb.WriteString("\n")
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

// ParseGenerationResponse extracts structured data from the model's raw response.
func ParseGenerationResponse(raw string, chunks []RankedChunk) (*GenerationResult, error) {
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
