package service

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"sort"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/model"
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
}

// NewRetrieverService creates a RetrieverService.
func NewRetrieverService(embedder QueryEmbedder, searcher VectorSearcher) *RetrieverService {
	return &RetrieverService{
		embedder: embedder,
		searcher: searcher,
	}
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

	slog.Info("[DEBUG-RETRIEVER] query embedded",
		"query", query,
		"user_id", userID,
		"vec_dim", len(queryVec),
		"vec_first3", fmt.Sprintf("%.4f, %.4f, %.4f", safeIdx(queryVec, 0), safeIdx(queryVec, 1), safeIdx(queryVec, 2)),
	)

	// 2. Vector search scoped to user's documents (top-20, threshold 0.35)
	excludePrivileged := !privilegeMode
	candidates, err := s.searcher.SimilaritySearch(ctx, queryVec, defaultTopK, defaultThreshold, userID, excludePrivileged)
	if err != nil {
		return nil, fmt.Errorf("service.Retrieve: search: %w", err)
	}

	slog.Info("[DEBUG-RETRIEVER] similarity search done",
		"user_id", userID,
		"candidates", len(candidates),
		"top_k", defaultTopK,
		"threshold", defaultThreshold,
		"exclude_privileged", excludePrivileged,
	)
	for i, c := range candidates {
		if i < 5 { // log top 5 only
			slog.Info("[DEBUG-RETRIEVER] candidate",
				"rank", i,
				"similarity", fmt.Sprintf("%.4f", c.Similarity),
				"doc_id", c.Document.ID,
				"doc_name", c.Document.OriginalName,
				"chunk_idx", c.Chunk.ChunkIndex,
			)
		}
	}

	if len(candidates) == 0 {
		return &RetrievalResult{
			Chunks:          []RankedChunk{},
			QueryEmbedding:  queryVec,
			TotalCandidates: 0,
		}, nil
	}

	// 3. Count unique documents across all candidates (for evidence tab)
	docSet := make(map[string]struct{})
	for _, c := range candidates {
		docSet[c.Document.ID] = struct{}{}
	}
	totalDocsFound := len(docSet)

	// 4. Re-rank
	ranked := rerank(candidates, time.Now().UTC())

	// 5. Deduplicate: max 2 chunks per source document
	deduped := deduplicate(ranked, maxChunksPerDocument)

	// 6. Return top-5
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
