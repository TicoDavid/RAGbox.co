package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
)

// EnrichmentResult is the parsed output from the Gemini enrichment call.
type EnrichmentResult struct {
	ContextualText string            `json:"contextual_text"`
	Entities       []EntityExtracted `json:"entities"`
	DocumentType   string            `json:"document_type"`
	KeyReferences  []string          `json:"key_references"`
}

// EntityExtracted represents a single entity extracted by Gemini.
type EntityExtracted struct {
	Name    string `json:"name"`
	Type    string `json:"type"`
	Role    string `json:"role"`
	Section string `json:"section"`
}

// EnricherService uses Gemini to extract entities and contextual metadata from chunks.
type EnricherService struct {
	client GenAIClient
	model  string
}

// NewEnricherService creates an EnricherService.
func NewEnricherService(client GenAIClient, model string) *EnricherService {
	return &EnricherService{client: client, model: model}
}

// Enrich calls Gemini to extract contextual text + entities for a chunk.
// FAIL-OPEN: returns empty result on error, never blocks the pipeline.
func (s *EnricherService) Enrich(ctx context.Context, fullDocText, chunkText string, chunkIndex int) (*EnrichmentResult, error) {
	prompt := buildEnrichmentPrompt(fullDocText, chunkText, chunkIndex)

	response, err := s.client.GenerateContent(ctx, "", prompt)
	if err != nil {
		slog.Error("enrichment call failed", "chunk_index", chunkIndex, "error", err)
		return &EnrichmentResult{}, nil // fail-open
	}

	var result EnrichmentResult
	// Strip markdown code fences if present
	cleaned := stripCodeFences(response)
	if err := json.Unmarshal([]byte(cleaned), &result); err != nil {
		preview := response
		if len(preview) > 200 {
			preview = preview[:200]
		}
		slog.Error("enrichment parse failed", "chunk_index", chunkIndex, "error", err, "raw", preview)
		return &EnrichmentResult{}, nil // fail-open
	}

	return &result, nil
}

func buildEnrichmentPrompt(fullDocText, chunkText string, chunkIndex int) string {
	return fmt.Sprintf(`<document>
%s
</document>

<chunk index="%d">
%s
</chunk>

Analyze this chunk within the context of its source document. Return a JSON object with exactly these fields:

{
  "contextual_text": "1-3 sentences that situate this chunk within the document. Include the document type, the section or topic, and any key parties or entities referenced.",
  "entities": [
    {"name": "exact name", "type": "person|organization|date|amount|clause|jurisdiction|document_ref", "role": "what role this entity plays in the chunk", "section": "which section of the document"}
  ],
  "document_type": "contract|agreement|policy|memo|correspondence|report|manual|other",
  "key_references": ["Section 3.2", "Exhibit A", "the table on page 4"]
}

Rules:
- contextual_text must be factual and specific. Include names, dates, and section numbers when present.
- entities: extract ALL named entities. Include people, companies, dates, monetary amounts, legal clauses, jurisdictions, and cross-references to other documents.
- Return ONLY the JSON object. No markdown, no explanation.`, fullDocText, chunkIndex, chunkText)
}

func stripCodeFences(s string) string {
	// Remove ```json ... ``` wrappers
	if len(s) > 7 && s[:7] == "```json" {
		s = s[7:]
	} else if len(s) > 3 && s[:3] == "```" {
		s = s[3:]
	}
	if len(s) > 3 && s[len(s)-3:] == "```" {
		s = s[:len(s)-3]
	}
	return s
}

