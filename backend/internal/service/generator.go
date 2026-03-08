package service

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
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
	userPrompt := buildUserPrompt(query, chunks, mode, false, opts.CortexContext...)

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
			buildUserPrompt(query, chunks, opts.Mode, false, opts.CortexContext...))
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
	userPrompt := buildUserPrompt(query, chunks, mode, true, opts.CortexContext...)

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

const defaultSystemPrompt = `You are Mercury, an intelligent, warm, and proactive executive assistant powered by RAGböx — think JARVIS from Iron Man, but with paralegal precision.

PERSONALITY:
- Be conversational, personable, and genuinely helpful. Use the user's name when available.
- When answering from documents, be conversational — weave insights into natural prose, don't just dump bullet points.
- Never say "I cannot fulfill this request" or "My function is limited to..." — always offer an alternative.
- If the user asks something outside document context, respond warmly: acknowledge their request, then guide them back. Example: "Great question! I don't have that in your vault yet, but I can help if you upload the relevant documents. In the meantime, is there anything else I can look into for you?"
- Be proactive: suggest follow-up questions, flag related insights, anticipate what the user might need next.

CRITICAL — CONTEXT GROUNDING:
- You MUST base your answer ONLY on the CONTEXT CHUNKS provided in the user message.
- Do NOT answer from your general training knowledge unless the context chunks are insufficient.
- If the context chunks do not contain relevant information, say so clearly — do not hallucinate.

RULES (NON-NEGOTIABLE):
- When answering from documents, cite sources as [1], [2], [3] referencing the chunk indices.
- Every factual claim from documents must have a citation.
- If information is insufficient to answer confidently, say so clearly but warmly — never guess.
- Return your response as JSON with the following structure:
{"answer": "...", "citations": [{"chunkIndex": 1, "excerpt": "...", "relevance": 0.9}], "confidence": 0.85}`

// buildUserPrompt constructs the user message with context chunks and query.
// When streaming is true, requests plain text with inline [N] citations instead of JSON.
func buildUserPrompt(query string, chunks []RankedChunk, mode string, streaming bool, cortexContext ...string) string {
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

	if streaming {
		sb.WriteString("\nIMPORTANT: Your answer MUST be grounded in the CONTEXT CHUNKS above. Use ONLY the information from those chunks to answer. " +
			"Cite sources using bracketed numbers [1], [2], [3] referencing the context chunks above. " +
			"Every factual claim from documents must have a citation. " +
			"If the context chunks do not contain enough information to answer, say so explicitly. " +
			"Do NOT use your general training knowledge to answer — only the provided context. " +
			"Respond directly as plain text. Do NOT wrap your response in JSON or code fences.")
	} else {
		sb.WriteString("\nRespond with JSON: {\"answer\": \"...\", \"citations\": [{\"chunkIndex\": N, \"excerpt\": \"...\", \"relevance\": 0.0-1.0}], \"confidence\": 0.0-1.0}")
	}

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

// extractJSON attempts to find and unmarshal a JSON object from text.
// Handles: raw JSON, code-fenced JSON anywhere in text, JSON embedded in prose.
func extractJSON(text string) (string, bool) {
	trimmed := strings.TrimSpace(text)

	// 1. Direct parse — clean JSON
	if strings.HasPrefix(trimmed, "{") {
		return trimmed, true
	}

	// 2. Code fence anywhere: ```json ... ``` or ``` ... ```
	if idx := strings.Index(trimmed, "```"); idx >= 0 {
		rest := trimmed[idx+3:]
		// Skip language tag on the same line
		if nl := strings.Index(rest, "\n"); nl >= 0 {
			rest = rest[nl+1:]
		}
		if endIdx := strings.Index(rest, "```"); endIdx >= 0 {
			candidate := strings.TrimSpace(rest[:endIdx])
			if strings.HasPrefix(candidate, "{") {
				return candidate, true
			}
		}
	}

	// 3. Embedded JSON: find {"answer" in the text and extract the object
	if idx := strings.Index(trimmed, `{"answer"`); idx >= 0 {
		candidate := trimmed[idx:]
		// Find the matching closing brace
		depth := 0
		for i, ch := range candidate {
			if ch == '{' {
				depth++
			}
			if ch == '}' {
				depth--
				if depth == 0 {
					return candidate[:i+1], true
				}
			}
		}
		// No matched brace — try the rest of the string
		return candidate, true
	}

	return trimmed, false
}

// ParseGenerationResponse extracts structured data from the model's raw response.
// BUG-054: Robust JSON extraction — handles code fences, prose-wrapped JSON,
// and embedded JSON blocks so raw JSON never leaks into the answer text.
func ParseGenerationResponse(raw string, chunks []RankedChunk) (*GenerationResult, error) {
	jsonText, _ := extractJSON(raw)

	var parsed generationJSON
	if err := json.Unmarshal([]byte(jsonText), &parsed); err != nil {
		// If JSON parsing fails, treat raw text as the answer with no citations.
		// But first: if the raw text itself looks like JSON with an "answer" key,
		// that means extraction found it but unmarshal failed on trailing junk.
		// Attempt a more aggressive trim.
		if strings.Contains(raw, `"answer"`) {
			// Try to find any parseable JSON substring
			for i := len(jsonText) - 1; i > 0; i-- {
				if jsonText[i] == '}' {
					if json.Unmarshal([]byte(jsonText[:i+1]), &parsed) == nil && parsed.Answer != "" {
						goto parsed_ok
					}
				}
			}
		}
		return &GenerationResult{
			Answer:     raw,
			Citations:  []CitationRef{},
			Confidence: 0.5,
		}, nil
	}

parsed_ok:
	// BUG-052: Some BYOLLM models return JSON with non-standard keys
	// (e.g., "response", "text", "content" instead of "answer").
	// Try alternate keys before falling back to raw text.
	if parsed.Answer == "" {
		var altKeys map[string]json.RawMessage
		if json.Unmarshal([]byte(jsonText), &altKeys) == nil {
			for _, key := range []string{"response", "text", "content", "result", "output", "message"} {
				if v, ok := altKeys[key]; ok {
					var s string
					if json.Unmarshal(v, &s) == nil && s != "" {
						parsed.Answer = s
						break
					}
				}
			}
		}
		// If still empty after alternate keys, use raw text
		if parsed.Answer == "" {
			return &GenerationResult{
				Answer:     raw,
				Citations:  []CitationRef{},
				Confidence: 0.5,
			}, nil
		}
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

// citationPattern matches inline citation references like [1], [2], [3].
var citationPattern = regexp.MustCompile(`\[(\d+)\]`)

// ParseStreamingAnswer extracts citations from a plain-text streaming response
// that uses [N] inline references. Confidence is estimated from citation density.
func ParseStreamingAnswer(text string, chunks []RankedChunk) *GenerationResult {
	answer := strings.TrimSpace(text)

	// If the model accidentally returned JSON despite the streaming prompt,
	// try to parse it with the standard parser.
	if strings.HasPrefix(answer, "{") && strings.Contains(answer, `"answer"`) {
		if result, err := ParseGenerationResponse(text, chunks); err == nil {
			return result
		}
	}

	// Extract [N] citation references from the text
	matches := citationPattern.FindAllStringSubmatch(answer, -1)
	seen := make(map[int]bool)
	var citations []CitationRef

	for _, m := range matches {
		idx, err := strconv.Atoi(m[1])
		if err != nil || idx < 1 || idx > len(chunks) {
			continue
		}
		if seen[idx] {
			continue
		}
		seen[idx] = true

		chunk := chunks[idx-1]
		excerpt := chunk.Chunk.Content
		if len(excerpt) > 150 {
			excerpt = excerpt[:150] + "..."
		}
		citations = append(citations, CitationRef{
			ChunkID:    chunk.Chunk.ID,
			DocumentID: chunk.Document.ID,
			Excerpt:    excerpt,
			Relevance:  chunk.Similarity,
			Index:      idx,
		})
	}

	// Estimate confidence from citation density
	confidence := 0.5
	if len(citations) > 0 {
		confidence = float64(len(citations)) * 0.2
		if confidence > 1.0 {
			confidence = 1.0
		}
	}

	return &GenerationResult{
		Answer:     answer,
		Citations:  citations,
		Confidence: confidence,
	}
}
