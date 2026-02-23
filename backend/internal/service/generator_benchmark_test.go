package service

import (
	"fmt"
	"testing"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/model"
)

func BenchmarkParseResponse(b *testing.B) {
	// Realistic JSON response from Gemini with citations
	raw := `{
		"answer": "The NDA requires both parties to maintain strict confidentiality of all proprietary information, trade secrets, and business methods [1]. The obligations survive for five (5) years after termination [2]. Neither party may disclose to third parties without prior written approval [1][3].",
		"confidence": 0.87,
		"citations": [
			{"chunkIndex": 1, "excerpt": "hold and maintain in strict confidence", "relevance": 0.92},
			{"chunkIndex": 2, "excerpt": "obligations survive for five years", "relevance": 0.88},
			{"chunkIndex": 3, "excerpt": "not disclose to others without approval", "relevance": 0.85}
		]
	}`

	// Build matching chunks
	now := time.Now()
	chunks := make([]RankedChunk, 5)
	for i := 0; i < 5; i++ {
		chunks[i] = RankedChunk{
			Chunk: model.DocumentChunk{
				ID:         fmt.Sprintf("chunk-%d", i),
				DocumentID: "doc-1",
				ChunkIndex: i,
				Content:    fmt.Sprintf("Chunk %d content about NDA terms and conditions.", i),
			},
			Similarity: 0.85,
			FinalScore: 0.87,
			Document: model.Document{
				ID:       "doc-1",
				UserID:   "bench-user",
				Filename: "nda.pdf",
				CreatedAt: now,
			},
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = parseGenerationResponse(raw, chunks)
	}
}
