package service

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

// makeBenchChunks generates n RankedChunks with realistic content.
func makeBenchChunks(n int) []RankedChunk {
	chunks := make([]RankedChunk, n)
	now := time.Now()
	for i := 0; i < n; i++ {
		chunks[i] = RankedChunk{
			Chunk: model.DocumentChunk{
				ID:          fmt.Sprintf("chunk-%d", i),
				DocumentID:  fmt.Sprintf("doc-%d", i%3),
				ChunkIndex:  i,
				Content:     fmt.Sprintf("Section %d: The confidentiality obligations shall extend to all proprietary information, trade secrets, and business methods disclosed during the term of this agreement. Each party acknowledges the value of such information.", i),
				ContentHash: fmt.Sprintf("hash-%d", i),
				TokenCount:  80,
			},
			Similarity: 0.82 - float64(i)*0.03,
			FinalScore: 0.85 - float64(i)*0.02,
			Document: model.Document{
				ID:       fmt.Sprintf("doc-%d", i%3),
				UserID:   "bench-user",
				Filename: fmt.Sprintf("nda-%d.pdf", i%3),
				CreatedAt: now,
			},
		}
	}
	return chunks
}

// makeBenchCitations generates citations referencing the chunks.
func makeBenchCitations(chunks []RankedChunk) []CitationRef {
	refs := make([]CitationRef, len(chunks))
	for i, c := range chunks {
		refs[i] = CitationRef{
			ChunkID:    c.Chunk.ID,
			DocumentID: c.Document.ID,
			Excerpt:    c.Chunk.Content[:60],
			Relevance:  c.FinalScore,
			Index:      i + 1,
		}
	}
	return refs
}

func BenchmarkCritiqueRelevance(b *testing.B) {
	chunks := makeBenchChunks(5)
	citations := makeBenchCitations(chunks)
	query := "What are the confidentiality obligations under the NDA?"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = critiqueRelevance(citations, query, chunks)
	}
}

func BenchmarkCritiqueSupport(b *testing.B) {
	chunks := makeBenchChunks(5)
	answer := "The confidentiality obligations extend to all proprietary information, trade secrets, " +
		"and business methods disclosed during the agreement term. Each party must protect the " +
		"disclosed information and may not share it with third parties without written consent."
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = critiqueSupport(answer, chunks)
	}
}

func BenchmarkCritiqueCompleteness(b *testing.B) {
	query := "What are the confidentiality obligations and duration of the NDA?"
	answer := "The NDA requires both parties to maintain strict confidentiality of all proprietary " +
		"information and trade secrets for a period of five years after termination."
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = critiqueCompleteness(query, answer)
	}
}

// benchGenerator is a minimal Generator mock for reflect benchmarks.
type benchGenerator struct {
	result *GenerationResult
}

func (g *benchGenerator) Generate(_ context.Context, _ string, _ []RankedChunk, _ GenerateOpts) (*GenerationResult, error) {
	return g.result, nil
}

func BenchmarkReflect_Full(b *testing.B) {
	chunks := makeBenchChunks(5)
	citations := makeBenchCitations(chunks)
	initial := &GenerationResult{
		Answer:     "The confidentiality obligations require each party to protect all proprietary information.",
		Citations:  citations,
		Confidence: 0.80,
		ModelUsed:  "gemini-1.5-pro",
	}
	gen := &benchGenerator{result: initial}
	svc := NewSelfRAGService(gen, 1, 0.60)
	ctx := context.Background()
	query := "What are the confidentiality obligations?"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = svc.Reflect(ctx, query, chunks, initial)
	}
}
