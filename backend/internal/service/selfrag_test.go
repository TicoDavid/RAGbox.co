package service

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// mockGenerator implements Generator for testing.
type mockGenerator struct {
	results []*GenerationResult // one per call
	callIdx int
	err     error
}

func (m *mockGenerator) Generate(ctx context.Context, query string, chunks []RankedChunk, opts GenerateOpts) (*GenerationResult, error) {
	if m.err != nil {
		return nil, m.err
	}
	if m.callIdx < len(m.results) {
		r := m.results[m.callIdx]
		m.callIdx++
		return r, nil
	}
	// Default fallback
	return &GenerationResult{
		Answer:     "improved answer",
		Citations:  []CitationRef{{ChunkID: "c1", Index: 1, Excerpt: "relevant text", Relevance: 0.9}},
		Confidence: 0.9,
	}, nil
}

func selfRAGChunks() []RankedChunk {
	return []RankedChunk{
		{
			Chunk:    model.DocumentChunk{ID: "c1", Content: "The contract expires on March 2025 with automatic renewal clause."},
			Document: model.Document{ID: "d1", CreatedAt: time.Now().UTC()},
		},
		{
			Chunk:    model.DocumentChunk{ID: "c2", Content: "Revenue reached $5M in Q4 2024, up 15% year over year."},
			Document: model.Document{ID: "d2", CreatedAt: time.Now().UTC()},
		},
	}
}

func TestReflect_HighConfidenceExitsEarly(t *testing.T) {
	gen := &mockGenerator{}
	svc := NewSelfRAGService(gen, 3, 0.85)

	initial := &GenerationResult{
		Answer: "The contract expires in March 2025 with renewal clause.",
		Citations: []CitationRef{
			{ChunkID: "c1", Index: 1, Excerpt: "expires on March 2025", Relevance: 0.95},
		},
		Confidence: 0.92,
	}

	result, err := svc.Reflect(context.Background(), "When does the contract expire?", selfRAGChunks(), initial)
	if err != nil {
		t.Fatalf("Reflect() error: %v", err)
	}

	if result.SilenceTriggered {
		t.Error("should not trigger silence for high confidence")
	}
	if result.Iterations > 1 {
		t.Errorf("expected early exit at iteration 1, got %d", result.Iterations)
	}
	if result.FinalConfidence < 0.85 {
		t.Errorf("FinalConfidence = %f, want >= 0.85", result.FinalConfidence)
	}
	if len(result.Critiques) != 1 {
		t.Errorf("expected 1 critique, got %d", len(result.Critiques))
	}
}

func TestReflect_LowConfidenceTriggersSilence(t *testing.T) {
	// Generator always returns low-quality answers
	gen := &mockGenerator{
		results: []*GenerationResult{
			{Answer: "bad answer 1", Citations: []CitationRef{}, Confidence: 0.3},
			{Answer: "bad answer 2", Citations: []CitationRef{}, Confidence: 0.3},
		},
	}
	svc := NewSelfRAGService(gen, 3, 0.85)

	initial := &GenerationResult{
		Answer:     "I'm not sure about this.",
		Citations:  []CitationRef{},
		Confidence: 0.3,
	}

	result, err := svc.Reflect(context.Background(), "What is quantum computing?", selfRAGChunks(), initial)
	if err != nil {
		t.Fatalf("Reflect() error: %v", err)
	}

	if !result.SilenceTriggered {
		t.Error("expected silence to be triggered for low confidence")
	}
	if result.Iterations != 3 {
		t.Errorf("expected 3 iterations (max), got %d", result.Iterations)
	}
}

func TestReflect_DropsWeakCitations(t *testing.T) {
	gen := &mockGenerator{}
	svc := NewSelfRAGService(gen, 1, 0.01) // very low threshold so it exits after 1 iteration

	initial := &GenerationResult{
		Answer: "Answer with weak citation.",
		Citations: []CitationRef{
			{ChunkID: "c1", Index: 1, Excerpt: "contract expires March", Relevance: 0.95},
			{ChunkID: "c2", Index: 2, Excerpt: "unrelated gibberish xyz", Relevance: 0.3},
		},
		Confidence: 0.7,
	}

	result, err := svc.Reflect(context.Background(), "contract expiry", selfRAGChunks(), initial)
	if err != nil {
		t.Fatalf("Reflect() error: %v", err)
	}

	// The weak citation (relevance 0.3 < 0.7) should be dropped
	if len(result.Critiques) == 0 {
		t.Fatal("expected at least 1 critique")
	}
	if len(result.Critiques[0].DroppedCitations) == 0 {
		t.Error("expected weak citations to be dropped")
	}

	// Final citations should not include the dropped one
	for _, c := range result.Citations {
		if c.Relevance < 0.7 && c.Relevance > 0 {
			t.Errorf("citation with relevance %f should have been dropped", c.Relevance)
		}
	}
}

func TestReflect_NilInitial(t *testing.T) {
	svc := NewSelfRAGService(&mockGenerator{}, 3, 0.85)

	_, err := svc.Reflect(context.Background(), "query", nil, nil)
	if err == nil {
		t.Fatal("expected error for nil initial result")
	}
}

func TestReflect_GeneratorError(t *testing.T) {
	gen := &mockGenerator{err: fmt.Errorf("generation failed")}
	svc := NewSelfRAGService(gen, 3, 0.99) // high threshold forces regeneration

	initial := &GenerationResult{
		Answer:     "partial answer",
		Citations:  []CitationRef{},
		Confidence: 0.3,
	}

	result, err := svc.Reflect(context.Background(), "query", selfRAGChunks(), initial)
	if err != nil {
		t.Fatalf("Reflect() should not error on generator failure: %v", err)
	}

	// Should return what it has with silence triggered
	if result.FinalAnswer != "partial answer" {
		t.Errorf("FinalAnswer = %q, want %q", result.FinalAnswer, "partial answer")
	}
}

func TestReflect_CritiqueHistory(t *testing.T) {
	gen := &mockGenerator{
		results: []*GenerationResult{
			{
				Answer:     "improved answer with contract and revenue details",
				Citations:  []CitationRef{{ChunkID: "c1", Index: 1, Excerpt: "contract expires", Relevance: 0.9}},
				Confidence: 0.88,
			},
		},
	}
	svc := NewSelfRAGService(gen, 3, 0.85)

	initial := &GenerationResult{
		Answer:     "vague answer",
		Citations:  []CitationRef{},
		Confidence: 0.4,
	}

	result, err := svc.Reflect(context.Background(), "contract and revenue", selfRAGChunks(), initial)
	if err != nil {
		t.Fatalf("Reflect() error: %v", err)
	}

	if len(result.Critiques) == 0 {
		t.Fatal("expected critique history")
	}

	for i, c := range result.Critiques {
		if c.Iteration != i+1 {
			t.Errorf("critique[%d].Iteration = %d, want %d", i, c.Iteration, i+1)
		}
		if c.RelevanceScore < 0 || c.RelevanceScore > 1 {
			t.Errorf("critique[%d].RelevanceScore = %f, want [0,1]", i, c.RelevanceScore)
		}
		if c.SupportScore < 0 || c.SupportScore > 1 {
			t.Errorf("critique[%d].SupportScore = %f, want [0,1]", i, c.SupportScore)
		}
		if c.CompletenessScore < 0 || c.CompletenessScore > 1 {
			t.Errorf("critique[%d].CompletenessScore = %f, want [0,1]", i, c.CompletenessScore)
		}
	}
}

func TestReflect_DefaultParameters(t *testing.T) {
	svc := NewSelfRAGService(&mockGenerator{}, 0, -1)
	if svc.maxIter != defaultMaxIterations {
		t.Errorf("maxIter = %d, want %d", svc.maxIter, defaultMaxIterations)
	}
	if svc.threshold != defaultConfidenceThreshold {
		t.Errorf("threshold = %f, want %f", svc.threshold, defaultConfidenceThreshold)
	}
}

func TestFilterCitations(t *testing.T) {
	citations := []CitationRef{
		{Index: 1, Relevance: 0.9},
		{Index: 2, Relevance: 0.3},
		{Index: 3, Relevance: 0.8},
	}

	result := filterCitations(citations, []int{2})
	if len(result) != 2 {
		t.Fatalf("expected 2 citations after filter, got %d", len(result))
	}
	for _, c := range result {
		if c.Index == 2 {
			t.Error("citation 2 should have been dropped")
		}
	}
}

func TestFilterCitations_NoneDropped(t *testing.T) {
	citations := []CitationRef{{Index: 1}, {Index: 2}}
	result := filterCitations(citations, nil)
	if len(result) != 2 {
		t.Errorf("expected 2 citations, got %d", len(result))
	}
}

func TestCritiqueRelevance(t *testing.T) {
	citations := []CitationRef{
		{Index: 1, Excerpt: "contract expires March 2025", Relevance: 0.95},
		{Index: 2, Excerpt: "random unrelated text", Relevance: 0.2},
	}

	score, dropped := critiqueRelevance(citations, "contract expiry date", nil)

	if score <= 0 {
		t.Errorf("relevance score = %f, want > 0", score)
	}
	if len(dropped) == 0 {
		t.Error("expected at least 1 dropped citation")
	}
}

func TestCritiqueSupport(t *testing.T) {
	chunks := selfRAGChunks()

	// Well-supported answer
	score := critiqueSupport("The contract expires March 2025 with automatic renewal.", chunks)
	if score < 0.3 {
		t.Errorf("support score for grounded answer = %f, want >= 0.3", score)
	}

	// Empty answer
	score = critiqueSupport("", chunks)
	if score != 0.0 {
		t.Errorf("support score for empty answer = %f, want 0.0", score)
	}
}

func TestCritiqueCompleteness(t *testing.T) {
	score := critiqueCompleteness("contract expiry", "The contract expires in March 2025.")
	if score < 0.3 {
		t.Errorf("completeness = %f, want >= 0.3", score)
	}

	score = critiqueCompleteness("revenue figures", "Nothing relevant found.")
	if score > 0.5 {
		t.Errorf("completeness for mismatched answer = %f, want < 0.5", score)
	}
}

func TestBuildRefinedQuery(t *testing.T) {
	q := buildRefinedQuery("original query", []string{"drop citations", "more detail"})
	if q == "original query" {
		t.Error("refined query should differ from original")
	}

	q2 := buildRefinedQuery("query", nil)
	if q2 != "query" {
		t.Error("no refinements should return original query")
	}
}

func TestSplitAnswerSentences(t *testing.T) {
	sentences := splitAnswerSentences("First sentence. Second sentence! Third?")
	if len(sentences) != 3 {
		t.Errorf("expected 3 sentences, got %d: %v", len(sentences), sentences)
	}
}
