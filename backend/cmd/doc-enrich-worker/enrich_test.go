// Sarah — EPIC-034 T3: Enrich Worker Tests — FAIL-OPEN CRITICAL
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// ── Mocks ──────────────────────────────────────────────────────

type mockEnricher struct {
	result *service.EnrichmentResult
	err    error
}

func (m *mockEnricher) Enrich(ctx context.Context, fullDocText, chunkText string, chunkIndex int) (*service.EnrichmentResult, error) {
	return m.result, m.err
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

func makeEnrichInput(overrides ...func(*enrichInput)) enrichInput {
	in := enrichInput{
		DocumentID:       "doc-001",
		TenantID:         "tenant-001",
		ChunkText:        "The parties agree to the terms set forth in Section 3.2.",
		ChunkIndex:       0,
		TokenCount:       45,
		PositionStart:    0,
		PositionEnd:      56,
		PageNumber:       1,
		FullDocumentText: "Full document text here. The parties agree to the terms set forth in Section 3.2. Additional clauses follow.",
		Filename:         "contract.pdf",
		TotalChunks:      5,
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

func TestProcessEnrich_SuccessfulEnrichment(t *testing.T) {
	enricher := &mockEnricher{
		result: &service.EnrichmentResult{
			ContextualText: "This chunk from a services agreement describes the terms in Section 3.2.",
			Entities: []service.EntityExtracted{
				{Name: "Acme Corp", Type: "organization", Role: "party", Section: "Section 3.2"},
			},
			DocumentType:  "agreement",
			KeyReferences: []string{"Section 3.2"},
		},
	}
	pub := &mockPub{}

	err := processEnrich(context.Background(), marshal(t, makeEnrichInput()), enricher, pub, "gemini-2.0-flash")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(pub.published) != 1 {
		t.Fatalf("expected 1 published message, got %d", len(pub.published))
	}

	output := pub.published[0].(enrichOutput)
	if output.ContextualText == "" {
		t.Error("expected non-empty ContextualText")
	}
	if len(output.Entities) != 1 {
		t.Errorf("expected 1 entity, got %d", len(output.Entities))
	}
}

func TestProcessEnrich_ParsesEntitiesCorrectly(t *testing.T) {
	enricher := &mockEnricher{
		result: &service.EnrichmentResult{
			ContextualText: "Context about payment terms.",
			Entities: []service.EntityExtracted{
				{Name: "Acme Corp", Type: "organization", Role: "party", Section: "Header"},
				{Name: "2025-01-15", Type: "date", Role: "effective_date", Section: "Section 1"},
				{Name: "$50,000", Type: "amount", Role: "contract_value", Section: "Section 3"},
			},
			DocumentType: "contract",
		},
	}
	pub := &mockPub{}

	err := processEnrich(context.Background(), marshal(t, makeEnrichInput()), enricher, pub, "gemini-2.0-flash")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	output := pub.published[0].(enrichOutput)
	if len(output.Entities) != 3 {
		t.Fatalf("expected 3 entities, got %d", len(output.Entities))
	}
	if output.Entities[0].Name != "Acme Corp" {
		t.Errorf("entity[0].Name = %q, want %q", output.Entities[0].Name, "Acme Corp")
	}
	if output.Entities[1].Type != "date" {
		t.Errorf("entity[1].Type = %q, want %q", output.Entities[1].Type, "date")
	}
	if output.Entities[2].Role != "contract_value" {
		t.Errorf("entity[2].Role = %q, want %q", output.Entities[2].Role, "contract_value")
	}
}

func TestProcessEnrich_ExtractsDocumentType(t *testing.T) {
	enricher := &mockEnricher{
		result: &service.EnrichmentResult{
			ContextualText: "NDA context.",
			DocumentType:   "agreement",
			Entities:       []service.EntityExtracted{{Name: "Party A", Type: "person"}},
		},
	}
	pub := &mockPub{}

	err := processEnrich(context.Background(), marshal(t, makeEnrichInput()), enricher, pub, "gemini-2.0-flash")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	output := pub.published[0].(enrichOutput)
	if output.DocumentType != "agreement" {
		t.Errorf("DocumentType = %q, want %q", output.DocumentType, "agreement")
	}
}

func TestProcessEnrich_SetsModelOnSuccess(t *testing.T) {
	enricher := &mockEnricher{
		result: &service.EnrichmentResult{
			ContextualText: "Valid context.",
			Entities:       []service.EntityExtracted{{Name: "X", Type: "person"}},
		},
	}
	pub := &mockPub{}

	err := processEnrich(context.Background(), marshal(t, makeEnrichInput()), enricher, pub, "gemini-2.0-flash")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	output := pub.published[0].(enrichOutput)
	if output.EnrichmentModel != "gemini-2.0-flash" {
		t.Errorf("EnrichmentModel = %q, want %q", output.EnrichmentModel, "gemini-2.0-flash")
	}
}

func TestProcessEnrich_FailOpen_GeminiAPIError(t *testing.T) {
	enricher := &mockEnricher{
		result: &service.EnrichmentResult{}, // empty result on error (fail-open from service)
		err:    fmt.Errorf("gemini: 503 service unavailable"),
	}
	pub := &mockPub{}

	err := processEnrich(context.Background(), marshal(t, makeEnrichInput()), enricher, pub, "gemini-2.0-flash")
	// FAIL-OPEN: handler should NOT return error — chunk still published
	if err != nil {
		t.Fatalf("FAIL-OPEN violated: handler returned error %v", err)
	}

	if len(pub.published) != 1 {
		t.Fatalf("FAIL-OPEN: expected 1 published message despite Gemini error, got %d", len(pub.published))
	}

	output := pub.published[0].(enrichOutput)
	if output.EnrichmentModel != "failed" {
		t.Errorf("EnrichmentModel = %q, want %q on error", output.EnrichmentModel, "failed")
	}
}

func TestProcessEnrich_FailOpen_EmptyResult(t *testing.T) {
	// Gemini returns success but empty result (malformed JSON parsed to empty)
	enricher := &mockEnricher{
		result: &service.EnrichmentResult{
			ContextualText: "",
			Entities:       nil,
		},
	}
	pub := &mockPub{}

	err := processEnrich(context.Background(), marshal(t, makeEnrichInput()), enricher, pub, "gemini-2.0-flash")
	if err != nil {
		t.Fatalf("FAIL-OPEN violated: handler returned error %v", err)
	}

	output := pub.published[0].(enrichOutput)
	if output.EnrichmentModel != "failed" {
		t.Errorf("EnrichmentModel = %q, want %q for empty result", output.EnrichmentModel, "failed")
	}
}

func TestProcessEnrich_FailOpen_StillPublishesChunkText(t *testing.T) {
	enricher := &mockEnricher{
		result: &service.EnrichmentResult{},
		err:    fmt.Errorf("timeout"),
	}
	pub := &mockPub{}
	input := makeEnrichInput()

	err := processEnrich(context.Background(), marshal(t, input), enricher, pub, "gemini-2.0-flash")
	if err != nil {
		t.Fatalf("FAIL-OPEN violated: %v", err)
	}

	output := pub.published[0].(enrichOutput)
	if output.ChunkText != input.ChunkText {
		t.Errorf("ChunkText not preserved in fail-open output")
	}
	if output.DocumentID != input.DocumentID {
		t.Errorf("DocumentID not preserved in fail-open output")
	}
	if output.TotalChunks != input.TotalChunks {
		t.Errorf("TotalChunks not preserved in fail-open output")
	}
}

func TestProcessEnrich_PublishFailure_ReturnsError(t *testing.T) {
	enricher := &mockEnricher{
		result: &service.EnrichmentResult{
			ContextualText: "context",
			Entities:       []service.EntityExtracted{{Name: "X", Type: "person"}},
		},
	}
	pub := &mockPub{err: fmt.Errorf("pubsub: connection refused")}

	err := processEnrich(context.Background(), marshal(t, makeEnrichInput()), enricher, pub, "gemini-2.0-flash")
	if err == nil {
		t.Fatal("expected error when publisher fails")
	}
}

func TestProcessEnrich_InvalidJSON(t *testing.T) {
	enricher := &mockEnricher{}
	pub := &mockPub{}

	err := processEnrich(context.Background(), []byte("not-json"), enricher, pub, "gemini-2.0-flash")
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestProcessEnrich_PreservesAllInputFields(t *testing.T) {
	enricher := &mockEnricher{
		result: &service.EnrichmentResult{
			ContextualText: "Context.",
			Entities:       []service.EntityExtracted{{Name: "E", Type: "person"}},
		},
	}
	pub := &mockPub{}
	input := makeEnrichInput(func(in *enrichInput) {
		in.ChunkIndex = 3
		in.TokenCount = 200
		in.PositionStart = 500
		in.PositionEnd = 700
		in.PageNumber = 2
	})

	err := processEnrich(context.Background(), marshal(t, input), enricher, pub, "gemini-2.0-flash")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	output := pub.published[0].(enrichOutput)
	if output.ChunkIndex != 3 {
		t.Errorf("ChunkIndex = %d, want 3", output.ChunkIndex)
	}
	if output.TokenCount != 200 {
		t.Errorf("TokenCount = %d, want 200", output.TokenCount)
	}
	if output.PositionStart != 500 {
		t.Errorf("PositionStart = %d, want 500", output.PositionStart)
	}
	if output.PositionEnd != 700 {
		t.Errorf("PositionEnd = %d, want 700", output.PositionEnd)
	}
	if output.PageNumber != 2 {
		t.Errorf("PageNumber = %d, want 2", output.PageNumber)
	}
}
