package handler

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/middleware"
	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// mockRetriever implements retrieval for testing.
type mockRetriever struct {
	result *service.RetrievalResult
	err    error
}

func (m *mockRetriever) Retrieve(ctx context.Context, query string, privilegeMode bool) (*service.RetrievalResult, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.result, nil
}

// mockChatGenerator implements service.Generator for testing.
type mockChatGenerator struct {
	result *service.GenerationResult
	err    error
}

func (m *mockChatGenerator) Generate(ctx context.Context, query string, chunks []service.RankedChunk, opts service.GenerateOpts) (*service.GenerationResult, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.result, nil
}

func testRetrievalResult() *service.RetrievalResult {
	return &service.RetrievalResult{
		Chunks: []service.RankedChunk{
			{
				Chunk:      model.DocumentChunk{ID: "c1", Content: "Contract expires March 2025."},
				Similarity: 0.95,
				FinalScore: 0.90,
				Document:   model.Document{ID: "d1", CreatedAt: time.Now().UTC(), ChunkCount: 10},
			},
		},
		QueryEmbedding:  make([]float32, 768),
		TotalCandidates: 1,
	}
}

func testGenerationResult() *service.GenerationResult {
	return &service.GenerationResult{
		Answer: "The contract expires in March 2025 [1].",
		Citations: []service.CitationRef{
			{ChunkID: "c1", DocumentID: "d1", Excerpt: "expires March 2025", Relevance: 0.95, Index: 1},
		},
		Confidence: 0.92,
	}
}

func makeChatDeps(retriever *mockRetriever, generator *mockChatGenerator) ChatDeps {
	gen := generator
	selfrag := service.NewSelfRAGService(gen, 1, 0.01) // Low threshold for quick exit
	return ChatDeps{
		Retriever: service.NewRetrieverService(
			&stubEmbedder{},
			&stubSearcher{result: retriever.result, err: retriever.err},
		),
		Generator: gen,
		SelfRAG:   selfrag,
	}
}

// stubEmbedder implements service.QueryEmbedder for wiring.
type stubEmbedder struct{}

func (s *stubEmbedder) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	result := make([][]float32, len(texts))
	for i := range texts {
		vec := make([]float32, 768)
		vec[0] = 1.0
		result[i] = vec
	}
	return result, nil
}

// stubSearcher implements service.VectorSearcher for wiring.
type stubSearcher struct {
	result *service.RetrievalResult
	err    error
}

func (s *stubSearcher) SimilaritySearch(ctx context.Context, queryVec []float32, topK int, threshold float64, userID string, excludePrivileged bool) ([]service.VectorSearchResult, error) {
	if s.err != nil {
		return nil, s.err
	}
	if s.result == nil {
		return nil, nil
	}
	results := make([]service.VectorSearchResult, len(s.result.Chunks))
	for i, c := range s.result.Chunks {
		results[i] = service.VectorSearchResult{
			Chunk:      c.Chunk,
			Similarity: c.Similarity,
			Document:   c.Document,
		}
	}
	return results, nil
}

func chatRequest(query string) *http.Request {
	body, _ := json.Marshal(ChatRequest{Query: query, Mode: "concise"})
	req := httptest.NewRequest(http.MethodPost, "/api/chat", bytes.NewReader(body))
	ctx := middleware.WithUserID(req.Context(), "test-user")
	return req.WithContext(ctx)
}

// parseSSEEvents reads SSE events from the response body.
func parseSSEEvents(body string) []sseEvent {
	var events []sseEvent
	scanner := bufio.NewScanner(strings.NewReader(body))
	var currentEvent, currentData string

	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "event: ") {
			currentEvent = strings.TrimPrefix(line, "event: ")
		} else if strings.HasPrefix(line, "data: ") {
			currentData = strings.TrimPrefix(line, "data: ")
		} else if line == "" && currentEvent != "" {
			events = append(events, sseEvent{Event: currentEvent, Data: currentData})
			currentEvent = ""
			currentData = ""
		}
	}
	return events
}

type sseEvent struct {
	Event string
	Data  string
}

func TestChat_SuccessStream(t *testing.T) {
	retriever := &mockRetriever{result: testRetrievalResult()}
	generator := &mockChatGenerator{result: testGenerationResult()}
	deps := makeChatDeps(retriever, generator)

	handler := Chat(deps)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, chatRequest("When does the contract expire?"))

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}

	contentType := w.Header().Get("Content-Type")
	if contentType != "text/event-stream" {
		t.Errorf("Content-Type = %q, want %q", contentType, "text/event-stream")
	}

	events := parseSSEEvents(w.Body.String())

	if len(events) == 0 {
		t.Fatal("expected SSE events")
	}

	// First event should be a status event
	if events[0].Event != "status" {
		t.Errorf("first event = %q, want 'status'", events[0].Event)
	}

	// Last event should be "done"
	lastEvent := events[len(events)-1]
	if lastEvent.Event != "done" {
		t.Errorf("last event = %q, want 'done'", lastEvent.Event)
	}

	// Should contain token events
	hasTokens := false
	hasCitations := false
	hasConfidence := false
	for _, e := range events {
		switch e.Event {
		case "token":
			hasTokens = true
		case "citations":
			hasCitations = true
		case "confidence":
			hasConfidence = true
		}
	}

	if !hasTokens {
		t.Error("expected token events in stream")
	}
	if !hasCitations {
		t.Error("expected citations event in stream")
	}
	if !hasConfidence {
		t.Error("expected confidence event in stream")
	}
}

func TestChat_SilenceProtocol(t *testing.T) {
	// Return empty retrieval to trigger silence
	retriever := &mockRetriever{
		result: &service.RetrievalResult{
			Chunks:          []service.RankedChunk{},
			TotalCandidates: 0,
		},
	}
	generator := &mockChatGenerator{result: testGenerationResult()}
	deps := makeChatDeps(retriever, generator)

	handler := Chat(deps)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, chatRequest("What is quantum computing?"))

	events := parseSSEEvents(w.Body.String())

	hasSilence := false
	for _, e := range events {
		if e.Event == "silence" {
			hasSilence = true
			var silence service.SilenceResponse
			if err := json.Unmarshal([]byte(e.Data), &silence); err != nil {
				t.Fatalf("failed to parse silence data: %v", err)
			}
			if silence.Protocol != "SILENCE_PROTOCOL" {
				t.Errorf("Protocol = %q, want %q", silence.Protocol, "SILENCE_PROTOCOL")
			}
		}
	}

	if !hasSilence {
		t.Error("expected silence event for empty retrieval")
	}

	// Should still end with done
	if events[len(events)-1].Event != "done" {
		t.Error("stream should end with done event")
	}
}

func TestChat_Unauthorized(t *testing.T) {
	deps := ChatDeps{}
	handler := Chat(deps)

	body, _ := json.Marshal(ChatRequest{Query: "test"})
	req := httptest.NewRequest(http.MethodPost, "/api/chat", bytes.NewReader(body))
	// No user ID in context

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", w.Code)
	}
}

func TestChat_EmptyQuery(t *testing.T) {
	deps := ChatDeps{}
	handler := Chat(deps)

	body, _ := json.Marshal(ChatRequest{Query: ""})
	req := httptest.NewRequest(http.MethodPost, "/api/chat", bytes.NewReader(body))
	ctx := middleware.WithUserID(req.Context(), "test-user")
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", w.Code)
	}
}

func TestChat_RetrievalError(t *testing.T) {
	retriever := &mockRetriever{err: fmt.Errorf("search failed")}
	generator := &mockChatGenerator{result: testGenerationResult()}
	deps := makeChatDeps(retriever, generator)

	handler := Chat(deps)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, chatRequest("test"))

	events := parseSSEEvents(w.Body.String())

	hasError := false
	for _, e := range events {
		if e.Event == "error" {
			hasError = true
		}
	}

	if !hasError {
		t.Error("expected error event when retrieval fails")
	}
}

func TestChat_SSEEventFormat(t *testing.T) {
	retriever := &mockRetriever{result: testRetrievalResult()}
	generator := &mockChatGenerator{result: testGenerationResult()}
	deps := makeChatDeps(retriever, generator)

	handler := Chat(deps)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, chatRequest("test query"))

	body := w.Body.String()

	// Verify SSE format: each event has "event: X\ndata: Y\n\n"
	if !strings.Contains(body, "event: ") {
		t.Error("response should contain SSE event: prefix")
	}
	if !strings.Contains(body, "data: ") {
		t.Error("response should contain SSE data: prefix")
	}
	if !strings.Contains(body, "\n\n") {
		t.Error("SSE events should be separated by double newlines")
	}
}

func TestSplitIntoTokens(t *testing.T) {
	tokens := splitIntoTokens("Hello world test")
	if len(tokens) != 3 {
		t.Fatalf("expected 3 tokens, got %d", len(tokens))
	}
	if tokens[0] != "Hello " {
		t.Errorf("token[0] = %q, want %q", tokens[0], "Hello ")
	}
	if tokens[2] != "test" {
		t.Errorf("token[2] = %q, want %q (no trailing space)", tokens[2], "test")
	}
}

func TestSplitIntoTokens_Empty(t *testing.T) {
	tokens := splitIntoTokens("")
	if tokens != nil {
		t.Errorf("expected nil for empty text, got %v", tokens)
	}
}

func TestBuildDonePayload_FullPayload(t *testing.T) {
	retrieval := &service.RetrievalResult{
		Chunks: []service.RankedChunk{
			{
				Chunk:      model.DocumentChunk{ID: "c1", Content: "Contract expires March 2025."},
				Similarity: 0.95,
				FinalScore: 0.90,
				Document:   model.Document{ID: "d1", OriginalName: "contract.pdf"},
			},
			{
				Chunk:      model.DocumentChunk{ID: "c2", Content: "Amendment signed."},
				Similarity: 0.80,
				FinalScore: 0.75,
				Document:   model.Document{ID: "d2", OriginalName: "amendment.pdf"},
			},
		},
		TotalCandidates: 42,
	}
	initial := &service.GenerationResult{
		Answer:     "Initial answer",
		Confidence: 0.85,
		ModelUsed:  "gemini-1.5-pro",
		LatencyMs:  200,
	}
	result := &service.ReflectionResult{
		FinalAnswer:     "The contract expires in March 2025.",
		FinalConfidence: 0.92,
		Citations: []service.CitationRef{
			{ChunkID: "c1", DocumentID: "d1", Excerpt: "expires March 2025", Relevance: 0.95, Index: 1},
		},
		Iterations: 2,
	}

	payload := buildDonePayload(retrieval, initial, result, time.Now(), "aegis")

	if payload.Answer != "The contract expires in March 2025." {
		t.Errorf("Answer = %q, want %q", payload.Answer, "The contract expires in March 2025.")
	}
	if len(payload.Sources) != 1 {
		t.Fatalf("Sources len = %d, want 1", len(payload.Sources))
	}
	if payload.Sources[0].DocumentName != "contract.pdf" {
		t.Errorf("Sources[0].DocumentName = %q, want %q", payload.Sources[0].DocumentName, "contract.pdf")
	}
	if payload.Sources[0].ChunkID != "c1" {
		t.Errorf("Sources[0].ChunkID = %q, want %q", payload.Sources[0].ChunkID, "c1")
	}
	if payload.Sources[0].PageNumber != nil {
		t.Errorf("Sources[0].PageNumber = %v, want nil", payload.Sources[0].PageNumber)
	}
	if payload.Evidence.TotalChunksSearched != 42 {
		t.Errorf("TotalChunksSearched = %d, want 42", payload.Evidence.TotalChunksSearched)
	}
	if payload.Evidence.TotalDocumentsSearched != 2 {
		t.Errorf("TotalDocumentsSearched = %d, want 2", payload.Evidence.TotalDocumentsSearched)
	}
	if payload.Evidence.ConfidenceScore != 0.92 {
		t.Errorf("ConfidenceScore = %f, want 0.92", payload.Evidence.ConfidenceScore)
	}
	if payload.Evidence.Model != "aegis/gemini-1.5-pro" {
		t.Errorf("Model = %q, want %q", payload.Evidence.Model, "aegis/gemini-1.5-pro")
	}
	if payload.Evidence.CitationCount != 1 {
		t.Errorf("CitationCount = %d, want 1", payload.Evidence.CitationCount)
	}
}

func TestBuildDonePayload_NilResult(t *testing.T) {
	initial := &service.GenerationResult{
		Answer:     "Fallback answer from initial",
		Confidence: 0.70,
		ModelUsed:  "gemini-1.5-pro",
		Citations: []service.CitationRef{
			{ChunkID: "c1", DocumentID: "d1", Excerpt: "test", Relevance: 0.8, Index: 1},
		},
	}

	payload := buildDonePayload(nil, initial, nil, time.Now(), "aegis")

	if payload.Answer != "Fallback answer from initial" {
		t.Errorf("Answer = %q, want %q", payload.Answer, "Fallback answer from initial")
	}
	if payload.Evidence.ConfidenceScore != 0.70 {
		t.Errorf("ConfidenceScore = %f, want 0.70", payload.Evidence.ConfidenceScore)
	}
	if len(payload.Sources) != 1 {
		t.Errorf("Sources len = %d, want 1", len(payload.Sources))
	}
}

func TestBuildDonePayload_AllNil(t *testing.T) {
	payload := buildDonePayload(nil, nil, nil, time.Now(), "")

	if payload.Answer != "" {
		t.Errorf("Answer = %q, want empty", payload.Answer)
	}
	if len(payload.Sources) != 0 {
		t.Errorf("Sources len = %d, want 0", len(payload.Sources))
	}
	if payload.Evidence.TotalChunksSearched != 0 {
		t.Errorf("TotalChunksSearched = %d, want 0", payload.Evidence.TotalChunksSearched)
	}
	if payload.Evidence.Model != "/" {
		t.Errorf("Model = %q, want %q", payload.Evidence.Model, "/")
	}
	if payload.Evidence.CitationCount != 0 {
		t.Errorf("CitationCount = %d, want 0", payload.Evidence.CitationCount)
	}
}

func TestChat_SuccessStream_StructuredDone(t *testing.T) {
	retriever := &mockRetriever{result: testRetrievalResult()}
	generator := &mockChatGenerator{result: testGenerationResult()}
	deps := makeChatDeps(retriever, generator)

	h := Chat(deps)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, chatRequest("When does the contract expire?"))

	events := parseSSEEvents(w.Body.String())

	lastEvent := events[len(events)-1]
	if lastEvent.Event != "done" {
		t.Fatalf("last event = %q, want 'done'", lastEvent.Event)
	}

	var payload DonePayload
	if err := json.Unmarshal([]byte(lastEvent.Data), &payload); err != nil {
		t.Fatalf("failed to parse done payload: %v", err)
	}

	if payload.Answer == "" {
		t.Error("done payload answer should not be empty for successful stream")
	}
	if payload.Evidence.Model == "" || payload.Evidence.Model == "/" {
		t.Error("done payload model should be set")
	}
	if payload.Evidence.LatencyMs <= 0 {
		t.Error("done payload latencyMs should be positive")
	}
}
