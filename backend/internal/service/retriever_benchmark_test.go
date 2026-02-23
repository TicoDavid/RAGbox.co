package service

import (
	"fmt"
	"testing"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// makeBenchCandidates generates n VectorSearchResults with realistic diversity.
func makeBenchCandidates(n int) []VectorSearchResult {
	results := make([]VectorSearchResult, n)
	now := time.Now()
	for i := 0; i < n; i++ {
		docID := fmt.Sprintf("doc-%d", i%5) // 5 unique documents
		results[i] = VectorSearchResult{
			Chunk: model.DocumentChunk{
				ID:          fmt.Sprintf("chunk-%d", i),
				DocumentID:  docID,
				ChunkIndex:  i,
				Content:     fmt.Sprintf("The parties agree to clause %d regarding obligations and rights under this agreement.", i),
				ContentHash: fmt.Sprintf("hash-%d", i),
				TokenCount:  120,
			},
			Similarity: 0.85 - float64(i)*0.02, // descending similarity
			Document: model.Document{
				ID:        docID,
				UserID:    "bench-user",
				Filename:  fmt.Sprintf("contract-%d.pdf", i%5),
				CreatedAt: now.Add(-time.Duration(i) * 24 * time.Hour),
			},
		}
	}
	return results
}

func BenchmarkRerank_20Candidates(b *testing.B) {
	candidates := makeBenchCandidates(20)
	now := time.Now()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = rerank(candidates, now)
	}
}

func BenchmarkDeduplicate_20Candidates(b *testing.B) {
	candidates := makeBenchCandidates(20)
	ranked := rerank(candidates, time.Now())
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = deduplicate(ranked, maxChunksPerDocument)
	}
}
