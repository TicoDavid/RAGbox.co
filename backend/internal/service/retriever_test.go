package service

import (
	"context"
	"fmt"
	"math"
	"testing"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// mockQueryEmbedder implements QueryEmbedder for testing.
type mockQueryEmbedder struct {
	vectors [][]float32
	err     error
}

func (m *mockQueryEmbedder) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	if m.err != nil {
		return nil, m.err
	}
	if m.vectors != nil {
		return m.vectors, nil
	}
	// Default: return a dummy vector per text
	result := make([][]float32, len(texts))
	for i := range texts {
		vec := make([]float32, 768)
		vec[0] = 1.0
		result[i] = vec
	}
	return result, nil
}

// mockVectorSearcher implements VectorSearcher for testing.
type mockVectorSearcher struct {
	results            []VectorSearchResult
	err                error
	capturedTopK       int
	capturedThreshold  float64
	capturedUserID     string
	capturedExcludePriv bool
}

func (m *mockVectorSearcher) SimilaritySearch(ctx context.Context, queryVec []float32, topK int, threshold float64, userID string, excludePrivileged bool) ([]VectorSearchResult, error) {
	m.capturedTopK = topK
	m.capturedThreshold = threshold
	m.capturedUserID = userID
	m.capturedExcludePriv = excludePrivileged
	if m.err != nil {
		return nil, m.err
	}
	return m.results, nil
}

func makeResult(docID string, content string, similarity float64, docCreatedAt time.Time, chunkCount int) VectorSearchResult {
	return VectorSearchResult{
		Chunk: model.DocumentChunk{
			ID:         "chunk-" + docID,
			DocumentID: docID,
			Content:    content,
		},
		Similarity: similarity,
		Document: model.Document{
			ID:         docID,
			ChunkCount: chunkCount,
			CreatedAt:  docCreatedAt,
		},
	}
}

func TestRetrieve_Success(t *testing.T) {
	now := time.Now().UTC()
	searcher := &mockVectorSearcher{
		results: []VectorSearchResult{
			makeResult("doc-1", "relevant chunk", 0.95, now.Add(-24*time.Hour), 10),
			makeResult("doc-2", "another chunk", 0.90, now.Add(-48*time.Hour), 5),
		},
	}
	embedder := &mockQueryEmbedder{}
	svc := NewRetrieverService(embedder, searcher)

	result, err := svc.Retrieve(context.Background(), "test-user", "test query", false)
	if err != nil {
		t.Fatalf("Retrieve() error: %v", err)
	}

	if len(result.Chunks) == 0 {
		t.Fatal("expected at least 1 chunk")
	}
	if result.TotalCandidates != 2 {
		t.Errorf("TotalCandidates = %d, want 2", result.TotalCandidates)
	}
	if len(result.QueryEmbedding) != 768 {
		t.Errorf("QueryEmbedding length = %d, want 768", len(result.QueryEmbedding))
	}
}

func TestRetrieve_EmptyQuery(t *testing.T) {
	svc := NewRetrieverService(&mockQueryEmbedder{}, &mockVectorSearcher{})

	_, err := svc.Retrieve(context.Background(), "test-user", "", false)
	if err == nil {
		t.Fatal("expected error for empty query")
	}
}

func TestRetrieve_EmbedError(t *testing.T) {
	embedder := &mockQueryEmbedder{err: fmt.Errorf("embed failed")}
	svc := NewRetrieverService(embedder, &mockVectorSearcher{})

	_, err := svc.Retrieve(context.Background(), "test-user", "test", false)
	if err == nil {
		t.Fatal("expected error when embed fails")
	}
}

func TestRetrieve_SearchError(t *testing.T) {
	searcher := &mockVectorSearcher{err: fmt.Errorf("search failed")}
	svc := NewRetrieverService(&mockQueryEmbedder{}, searcher)

	_, err := svc.Retrieve(context.Background(), "test-user", "test", false)
	if err == nil {
		t.Fatal("expected error when search fails")
	}
}

func TestRetrieve_NoCandidates(t *testing.T) {
	searcher := &mockVectorSearcher{results: []VectorSearchResult{}}
	svc := NewRetrieverService(&mockQueryEmbedder{}, searcher)

	result, err := svc.Retrieve(context.Background(), "test-user", "test", false)
	if err != nil {
		t.Fatalf("Retrieve() error: %v", err)
	}
	if len(result.Chunks) != 0 {
		t.Errorf("expected 0 chunks, got %d", len(result.Chunks))
	}
	if result.TotalCandidates != 0 {
		t.Errorf("TotalCandidates = %d, want 0", result.TotalCandidates)
	}
}

func TestRetrieve_PrivilegeModeExcludesPrivileged(t *testing.T) {
	searcher := &mockVectorSearcher{results: []VectorSearchResult{}}
	svc := NewRetrieverService(&mockQueryEmbedder{}, searcher)

	// privilegeMode=false → excludePrivileged=true
	svc.Retrieve(context.Background(), "test-user", "test", false)
	if !searcher.capturedExcludePriv {
		t.Error("expected excludePrivileged=true when privilegeMode=false")
	}

	// privilegeMode=true → excludePrivileged=false
	svc.Retrieve(context.Background(), "test-user", "test", true)
	if searcher.capturedExcludePriv {
		t.Error("expected excludePrivileged=false when privilegeMode=true")
	}
}

func TestRetrieve_SearchParameters(t *testing.T) {
	searcher := &mockVectorSearcher{results: []VectorSearchResult{}}
	svc := NewRetrieverService(&mockQueryEmbedder{}, searcher)

	svc.Retrieve(context.Background(), "test-user", "test", false)

	if searcher.capturedTopK != 20 {
		t.Errorf("topK = %d, want 20", searcher.capturedTopK)
	}
	if searcher.capturedThreshold != 0.35 {
		t.Errorf("threshold = %f, want 0.35", searcher.capturedThreshold)
	}
}

func TestRetrieve_ReturnsMax5(t *testing.T) {
	now := time.Now().UTC()
	results := make([]VectorSearchResult, 10)
	for i := range results {
		results[i] = makeResult(fmt.Sprintf("doc-%d", i), fmt.Sprintf("chunk %d", i),
			0.9-float64(i)*0.01, now, 10)
	}

	searcher := &mockVectorSearcher{results: results}
	svc := NewRetrieverService(&mockQueryEmbedder{}, searcher)

	result, err := svc.Retrieve(context.Background(), "test-user", "test", true)
	if err != nil {
		t.Fatalf("Retrieve() error: %v", err)
	}

	if len(result.Chunks) != 5 {
		t.Errorf("expected 5 chunks (limit), got %d", len(result.Chunks))
	}
	if result.TotalCandidates != 10 {
		t.Errorf("TotalCandidates = %d, want 10", result.TotalCandidates)
	}
}

func TestRetrieve_Deduplication(t *testing.T) {
	now := time.Now().UTC()
	// 4 chunks from same doc, 1 from another — should get max 2 from same doc
	searcher := &mockVectorSearcher{
		results: []VectorSearchResult{
			makeResult("doc-A", "chunk A1", 0.95, now, 10),
			makeResult("doc-A", "chunk A2", 0.93, now, 10),
			makeResult("doc-A", "chunk A3", 0.91, now, 10),
			makeResult("doc-A", "chunk A4", 0.89, now, 10),
			makeResult("doc-B", "chunk B1", 0.87, now, 10),
		},
	}
	// Give them distinct chunk IDs
	for i := range searcher.results {
		searcher.results[i].Chunk.ID = fmt.Sprintf("chunk-%d", i)
	}

	svc := NewRetrieverService(&mockQueryEmbedder{}, searcher)

	result, err := svc.Retrieve(context.Background(), "test-user", "test", true)
	if err != nil {
		t.Fatalf("Retrieve() error: %v", err)
	}

	docCounts := make(map[string]int)
	for _, c := range result.Chunks {
		docCounts[c.Document.ID]++
	}

	if docCounts["doc-A"] > 2 {
		t.Errorf("doc-A has %d chunks, want max 2", docCounts["doc-A"])
	}
	if docCounts["doc-B"] != 1 {
		t.Errorf("doc-B has %d chunks, want 1", docCounts["doc-B"])
	}
}

func TestRetrieve_RankingOrder(t *testing.T) {
	now := time.Now().UTC()
	// doc-1: high similarity, old doc, few chunks
	// doc-2: lower similarity, recent doc, many chunks
	searcher := &mockVectorSearcher{
		results: []VectorSearchResult{
			makeResult("doc-1", "old high sim", 0.95, now.Add(-300*24*time.Hour), 2),
			makeResult("doc-2", "new lower sim", 0.85, now.Add(-1*24*time.Hour), 40),
		},
	}

	svc := NewRetrieverService(&mockQueryEmbedder{}, searcher)

	result, err := svc.Retrieve(context.Background(), "test-user", "test", true)
	if err != nil {
		t.Fatalf("Retrieve() error: %v", err)
	}

	if len(result.Chunks) != 2 {
		t.Fatalf("expected 2 chunks, got %d", len(result.Chunks))
	}

	// Both should have FinalScore > 0
	for i, c := range result.Chunks {
		if c.FinalScore <= 0 {
			t.Errorf("chunk[%d] FinalScore = %f, want > 0", i, c.FinalScore)
		}
	}

	// Chunks should be sorted by FinalScore descending
	if result.Chunks[0].FinalScore < result.Chunks[1].FinalScore {
		t.Error("chunks should be sorted by FinalScore descending")
	}
}

func TestRecencyBoost(t *testing.T) {
	now := time.Now().UTC()

	tests := []struct {
		name     string
		docAge   time.Duration
		wantMin  float64
		wantMax  float64
	}{
		{"recent (1 day)", 24 * time.Hour, 0.99, 1.0},
		{"week old", 7 * 24 * time.Hour, 0.99, 1.0},
		{"6 months old", 180 * 24 * time.Hour, 0.4, 0.6},
		{"1 year old", 365 * 24 * time.Hour, 0.0, 0.01},
		{"2 years old", 730 * 24 * time.Hour, 0.0, 0.01},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			boost := recencyBoost(now.Add(-tt.docAge), now)
			if boost < tt.wantMin || boost > tt.wantMax {
				t.Errorf("recencyBoost = %f, want [%f, %f]", boost, tt.wantMin, tt.wantMax)
			}
		})
	}
}

func TestParentDocBoost(t *testing.T) {
	tests := []struct {
		chunkCount int
		want       float64
	}{
		{0, 0.0},
		{1, 0.02},
		{25, 0.50},
		{50, 1.00},
		{100, 1.00}, // capped at 1.0
	}

	for _, tt := range tests {
		got := parentDocBoost(tt.chunkCount)
		if math.Abs(got-tt.want) > 0.01 {
			t.Errorf("parentDocBoost(%d) = %f, want %f", tt.chunkCount, got, tt.want)
		}
	}
}

func TestDeduplicate(t *testing.T) {
	ranked := []RankedChunk{
		{Document: model.Document{ID: "a"}, FinalScore: 0.9},
		{Document: model.Document{ID: "a"}, FinalScore: 0.8},
		{Document: model.Document{ID: "a"}, FinalScore: 0.7},
		{Document: model.Document{ID: "b"}, FinalScore: 0.6},
		{Document: model.Document{ID: "b"}, FinalScore: 0.5},
		{Document: model.Document{ID: "b"}, FinalScore: 0.4},
	}

	result := deduplicate(ranked, 2)

	docCounts := make(map[string]int)
	for _, r := range result {
		docCounts[r.Document.ID]++
	}

	if docCounts["a"] != 2 {
		t.Errorf("doc a count = %d, want 2", docCounts["a"])
	}
	if docCounts["b"] != 2 {
		t.Errorf("doc b count = %d, want 2", docCounts["b"])
	}
	if len(result) != 4 {
		t.Errorf("total results = %d, want 4", len(result))
	}
}

func TestReciprocalRankFusion_CombinesResults(t *testing.T) {
	now := time.Now().UTC()
	vectorResults := []VectorSearchResult{
		makeResult("doc-1", "vector match 1", 0.95, now, 10),
		makeResult("doc-2", "vector match 2", 0.85, now, 5),
	}
	vectorResults[0].Chunk.ID = "chunk-v1"
	vectorResults[1].Chunk.ID = "chunk-v2"

	bm25Results := []VectorSearchResult{
		makeResult("doc-2", "bm25 match (same as vector)", 0.90, now, 5),
		makeResult("doc-3", "bm25 only match", 0.80, now, 8),
	}
	bm25Results[0].Chunk.ID = "chunk-v2" // same chunk as vector result
	bm25Results[1].Chunk.ID = "chunk-b1"

	fused := reciprocalRankFusion(vectorResults, bm25Results)

	if len(fused) != 3 {
		t.Fatalf("fused count = %d, want 3 (2 vector + 1 bm25-only, 1 overlap)", len(fused))
	}

	// chunk-v2 appears in both lists → should have highest RRF score
	if fused[0].Chunk.ID != "chunk-v2" {
		t.Errorf("expected chunk-v2 (in both lists) to rank first, got %s", fused[0].Chunk.ID)
	}
}

func TestReciprocalRankFusion_EmptyBM25(t *testing.T) {
	now := time.Now().UTC()
	vectorResults := []VectorSearchResult{
		makeResult("doc-1", "only vector", 0.95, now, 10),
	}
	vectorResults[0].Chunk.ID = "chunk-1"

	fused := reciprocalRankFusion(vectorResults, nil)

	if len(fused) != 1 {
		t.Fatalf("fused count = %d, want 1", len(fused))
	}
	if fused[0].Chunk.ID != "chunk-1" {
		t.Errorf("expected chunk-1, got %s", fused[0].Chunk.ID)
	}
}

func TestRetrieve_BackwardCompatible_NilBM25(t *testing.T) {
	now := time.Now().UTC()
	searcher := &mockVectorSearcher{
		results: []VectorSearchResult{
			makeResult("doc-1", "vector only", 0.90, now, 10),
		},
	}
	svc := NewRetrieverService(&mockQueryEmbedder{}, searcher)
	// bm25 is nil by default — should work fine

	result, err := svc.Retrieve(context.Background(), "test-user", "test", false)
	if err != nil {
		t.Fatalf("Retrieve with nil bm25 should succeed: %v", err)
	}
	if len(result.Chunks) != 1 {
		t.Errorf("expected 1 chunk, got %d", len(result.Chunks))
	}
}

func TestRetrieve_HybridWithBM25(t *testing.T) {
	now := time.Now().UTC()
	vectorSearcher := &mockVectorSearcher{
		results: []VectorSearchResult{
			makeResult("doc-1", "vector match", 0.90, now, 10),
		},
	}
	vectorSearcher.results[0].Chunk.ID = "chunk-v1"

	bm25Mock := &mockBM25Searcher{
		results: []VectorSearchResult{
			makeResult("doc-2", "bm25 match", 0.80, now, 5),
		},
	}
	bm25Mock.results[0].Chunk.ID = "chunk-b1"

	svc := NewRetrieverService(&mockQueryEmbedder{}, vectorSearcher)
	svc.SetBM25(bm25Mock)

	result, err := svc.Retrieve(context.Background(), "test-user", "Section 4.2", false)
	if err != nil {
		t.Fatalf("Retrieve with BM25 error: %v", err)
	}

	if len(result.Chunks) != 2 {
		t.Errorf("expected 2 chunks (vector + bm25), got %d", len(result.Chunks))
	}
	if result.TotalDocumentsFound != 2 {
		t.Errorf("TotalDocumentsFound = %d, want 2", result.TotalDocumentsFound)
	}
}

// mockBM25Searcher implements BM25Searcher for testing.
type mockBM25Searcher struct {
	results []VectorSearchResult
	err     error
}

func (m *mockBM25Searcher) FullTextSearch(ctx context.Context, query string, topK int, userID string) ([]VectorSearchResult, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.results, nil
}

func TestRerank(t *testing.T) {
	now := time.Now().UTC()

	candidates := []VectorSearchResult{
		{
			Chunk:      model.DocumentChunk{ID: "c1", Content: "chunk 1"},
			Similarity: 0.9,
			Document:   model.Document{ID: "d1", CreatedAt: now.Add(-1 * 24 * time.Hour), ChunkCount: 30},
		},
		{
			Chunk:      model.DocumentChunk{ID: "c2", Content: "chunk 2"},
			Similarity: 0.8,
			Document:   model.Document{ID: "d2", CreatedAt: now.Add(-200 * 24 * time.Hour), ChunkCount: 5},
		},
	}

	ranked := rerank(candidates, now)

	if len(ranked) != 2 {
		t.Fatalf("expected 2 ranked, got %d", len(ranked))
	}

	// First result should have higher final score
	if ranked[0].FinalScore <= ranked[1].FinalScore {
		t.Errorf("expected ranked[0].FinalScore > ranked[1].FinalScore, got %f vs %f",
			ranked[0].FinalScore, ranked[1].FinalScore)
	}

	// Verify final score components are reasonable
	for i, r := range ranked {
		if r.FinalScore <= 0 || r.FinalScore > 1.0 {
			t.Errorf("ranked[%d].FinalScore = %f, want (0, 1]", i, r.FinalScore)
		}
		if r.Similarity != candidates[i].Similarity {
			t.Errorf("ranked[%d].Similarity = %f, want %f", i, r.Similarity, candidates[i].Similarity)
		}
	}
}
