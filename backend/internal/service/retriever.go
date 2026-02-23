package service

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"sort"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/model"
	"golang.org/x/sync/errgroup"
)

const (
	// defaultTopK is the number of candidates to fetch from pgvector.
	defaultTopK = 20
	// defaultThreshold is the minimum cosine similarity for candidates.
	// text-embedding-004 with asymmetric task types (RETRIEVAL_DOCUMENT + RETRIEVAL_QUERY)
	// produces lower absolute similarity than symmetric embeddings. Related content
	// typically scores 0.50-0.70; threshold 0.35 captures relevant results while filtering noise.
	defaultThreshold = 0.35
	// defaultReturnLimit is the number of ranked results to return.
	defaultReturnLimit = 5
	// maxChunksPerDocument limits deduplication to this many chunks per source document.
	maxChunksPerDocument = 2

	// Re-ranking weights
	weightSimilarity = 0.70
	weightRecency    = 0.15
	weightParentDoc  = 0.15
)

// VectorSearchResult mirrors the repository ChunkResult without importing the repository package.
type VectorSearchResult struct {
	Chunk      model.DocumentChunk
	Similarity float64
	Document   model.Document
}

// VectorSearcher abstracts similarity search for testability.
type VectorSearcher interface {
	SimilaritySearch(ctx context.Context, queryVec []float32, topK int, threshold float64, userID string, excludePrivileged bool) ([]VectorSearchResult, error)
}

// QueryEmbedder abstracts query embedding for testability.
type QueryEmbedder interface {
	Embed(ctx context.Context, texts []string) ([][]float32, error)
}

// BM25Searcher abstracts full-text search for testability.
type BM25Searcher interface {
	FullTextSearch(ctx context.Context, query string, topK int, userID string) ([]VectorSearchResult, error)
}

// RankedChunk is a chunk with its final re-ranked score and parent document metadata.
type RankedChunk struct {
	Chunk      model.DocumentChunk `json:"chunk"`
	Similarity float64             `json:"similarity"`
	FinalScore float64             `json:"finalScore"`
	Document   model.Document      `json:"document"`
}

// RetrievalResult contains the ranked chunks and query metadata.
type RetrievalResult struct {
	Chunks              []RankedChunk `json:"chunks"`
	QueryEmbedding      []float32     `json:"-"`
	TotalCandidates     int           `json:"totalCandidates"`
	TotalDocumentsFound int           `json:"totalDocumentsFound"`
}

// RetrieverService processes queries and retrieves relevant document chunks.
type RetrieverService struct {
	embedder QueryEmbedder
	searcher VectorSearcher
	bm25     BM25Searcher // nil = vector-only (backward compatible)
}

// NewRetrieverService creates a RetrieverService.
func NewRetrieverService(embedder QueryEmbedder, searcher VectorSearcher) *RetrieverService {
	return &RetrieverService{
		embedder: embedder,
		searcher: searcher,
	}
}

// Embedder returns the underlying QueryEmbedder for external embedding.
func (s *RetrieverService) Embedder() QueryEmbedder {
	return s.embedder
}

// SetBM25 attaches a BM25Searcher for hybrid retrieval.
// When nil (default), retrieval is vector-only.
func (s *RetrieverService) SetBM25(bm25 BM25Searcher) {
	s.bm25 = bm25
}

// Retrieve embeds a query, performs similarity search scoped to the user's documents,
// re-ranks, deduplicates, and returns the top results.
func (s *RetrieverService) Retrieve(ctx context.Context, userID string, query string, privilegeMode bool) (*RetrievalResult, error) {
	if query == "" {
		return nil, fmt.Errorf("service.Retrieve: query is empty")
	}

	// 1. Embed the query
	queryVecs, err := s.embedder.Embed(ctx, []string{query})
	if err != nil {
		return nil, fmt.Errorf("service.Retrieve: embed: %w", err)
	}
	queryVec := queryVecs[0]

	return s.retrieveWithVec(ctx, userID, query, queryVec, privilegeMode)
}

// RetrieveWithVec performs retrieval using a pre-computed query embedding vector.
// This skips the embedding step, enabling parallel cache check + embedding.
// The query string is used for BM25 full-text search when available.
func (s *RetrieverService) RetrieveWithVec(ctx context.Context, userID, query string, queryVec []float32, privilegeMode bool) (*RetrievalResult, error) {
	return s.retrieveWithVec(ctx, userID, query, queryVec, privilegeMode)
}

func (s *RetrieverService) retrieveWithVec(ctx context.Context, userID string, query string, queryVec []float32, privilegeMode bool) (*RetrievalResult, error) {
	slog.Info("[DEBUG-RETRIEVER] query embedded",
		"query", query,
		"user_id", userID,
		"vec_dim", len(queryVec),
		"vec_first3", fmt.Sprintf("%.4f, %.4f, %.4f", safeIdx(queryVec, 0), safeIdx(queryVec, 1), safeIdx(queryVec, 2)),
	)

	// 2. Run vector + BM25 concurrently (STORY-154)
	excludePrivileged := !privilegeMode
	var vectorResults, bm25Results []VectorSearchResult

	g, gCtx := errgroup.WithContext(ctx)

	g.Go(func() error {
		var err error
		vectorResults, err = s.searcher.SimilaritySearch(gCtx, queryVec, defaultTopK, defaultThreshold, userID, excludePrivileged)
		return err
	})

	if s.bm25 != nil && query != "" {
		g.Go(func() error {
			var err error
			bm25Results, err = s.bm25.FullTextSearch(gCtx, query, defaultTopK, userID)
			return err
		})
	}

	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("service.Retrieve: search: %w", err)
	}

	slog.Info("[DEBUG-RETRIEVER] search done",
		"user_id", userID,
		"vector_candidates", len(vectorResults),
		"bm25_candidates", len(bm25Results),
		"top_k", defaultTopK,
		"threshold", defaultThreshold,
		"exclude_privileged", excludePrivileged,
	)
	for i, c := range vectorResults {
		if i < 5 {
			slog.Info("[DEBUG-RETRIEVER] candidate",
				"rank", i,
				"source", "vector",
				"similarity", fmt.Sprintf("%.4f", c.Similarity),
				"doc_id", c.Document.ID,
				"doc_name", c.Document.OriginalName,
				"chunk_idx", c.Chunk.ChunkIndex,
			)
		}
	}

	// 3. Fuse results with Reciprocal Rank Fusion (or vector-only if no BM25)
	var candidates []VectorSearchResult
	if len(bm25Results) > 0 {
		candidates = reciprocalRankFusion(vectorResults, bm25Results)
	} else {
		candidates = vectorResults
	}

	if len(candidates) == 0 {
		return &RetrievalResult{
			Chunks:          []RankedChunk{},
			QueryEmbedding:  queryVec,
			TotalCandidates: 0,
		}, nil
	}

	// 4. Count unique documents across all candidates (for evidence tab)
	docSet := make(map[string]struct{})
	for _, c := range candidates {
		docSet[c.Document.ID] = struct{}{}
	}
	totalDocsFound := len(docSet)

	// 5. Re-rank
	ranked := rerank(candidates, time.Now().UTC())

	// 6. Deduplicate: max 2 chunks per source document
	deduped := deduplicate(ranked, maxChunksPerDocument)

	// 7. Return top-5
	limit := defaultReturnLimit
	if limit > len(deduped) {
		limit = len(deduped)
	}

	return &RetrievalResult{
		Chunks:              deduped[:limit],
		QueryEmbedding:      queryVec,
		TotalCandidates:     len(candidates),
		TotalDocumentsFound: totalDocsFound,
	}, nil
}

// rerank scores candidates using a weighted formula:
// FinalScore = 0.70*similarity + 0.15*recencyBoost + 0.15*parentDocBoost
func rerank(candidates []VectorSearchResult, now time.Time) []RankedChunk {
	ranked := make([]RankedChunk, len(candidates))

	for i, c := range candidates {
		recency := recencyBoost(c.Document.CreatedAt, now)
		parentDoc := parentDocBoost(c.Document.ChunkCount)

		finalScore := weightSimilarity*c.Similarity +
			weightRecency*recency +
			weightParentDoc*parentDoc

		ranked[i] = RankedChunk{
			Chunk:      c.Chunk,
			Similarity: c.Similarity,
			FinalScore: finalScore,
			Document:   c.Document,
		}
	}

	sort.Slice(ranked, func(i, j int) bool {
		return ranked[i].FinalScore > ranked[j].FinalScore
	})

	return ranked
}

// recencyBoost returns a score [0, 1] based on document age.
// Documents created within the last 7 days get 1.0, decaying to 0 at 365 days.
func recencyBoost(docCreated time.Time, now time.Time) float64 {
	daysSince := now.Sub(docCreated).Hours() / 24
	if daysSince < 0 {
		daysSince = 0
	}
	if daysSince <= 7 {
		return 1.0
	}
	if daysSince >= 365 {
		return 0.0
	}
	// Linear decay from 1.0 at 7 days to 0.0 at 365 days
	return 1.0 - (daysSince-7)/(365-7)
}

// parentDocBoost returns a score [0, 1] based on the document's chunk count.
// Documents with more chunks (more content) get a higher boost, capped at 50 chunks.
func parentDocBoost(chunkCount int) float64 {
	if chunkCount <= 0 {
		return 0.0
	}
	cap := 50.0
	return math.Min(float64(chunkCount)/cap, 1.0)
}

// safeIdx returns vec[i] or 0 if out of bounds.
func safeIdx(vec []float32, i int) float32 {
	if i < len(vec) {
		return vec[i]
	}
	return 0
}

// reciprocalRankFusion combines results from vector and BM25 search methods.
// score = sum(1 / (k + rank_in_list)) for each list the doc appears in.
// k=60 is the standard RRF constant that balances rank positions.
func reciprocalRankFusion(vectorResults, bm25Results []VectorSearchResult) []VectorSearchResult {
	const k = 60
	scores := make(map[string]float64)          // chunk ID → RRF score
	items := make(map[string]VectorSearchResult) // chunk ID → result

	for rank, item := range vectorResults {
		id := item.Chunk.ID
		scores[id] += 1.0 / float64(k+rank+1)
		if _, exists := items[id]; !exists {
			items[id] = item
		}
	}

	for rank, item := range bm25Results {
		id := item.Chunk.ID
		scores[id] += 1.0 / float64(k+rank+1)
		if _, exists := items[id]; !exists {
			items[id] = item
		}
	}

	type scored struct {
		result VectorSearchResult
		score  float64
	}
	var sorted []scored
	for id, item := range items {
		sorted = append(sorted, scored{item, scores[id]})
	}
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].score > sorted[j].score })

	results := make([]VectorSearchResult, len(sorted))
	for i, s := range sorted {
		results[i] = s.result
	}
	return results
}

// deduplicate limits the number of chunks from any single document.
func deduplicate(ranked []RankedChunk, maxPerDoc int) []RankedChunk {
	docCount := make(map[string]int)
	var result []RankedChunk

	for _, r := range ranked {
		if docCount[r.Document.ID] >= maxPerDoc {
			continue
		}
		docCount[r.Document.ID]++
		result = append(result, r)
	}

	return result
}
