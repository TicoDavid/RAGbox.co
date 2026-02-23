package service

import (
	"context"
	"strings"
	"testing"
)

// generateLongText creates realistic legal-style text of approximately pageCount pages.
// Assumes ~3000 chars per page (typical for legal documents).
func generateLongText(pageCount int) string {
	paragraph := "WHEREAS, the parties hereto desire to enter into an agreement governing the terms and conditions " +
		"of the disclosure of confidential information, trade secrets, and proprietary data between them. " +
		"NOW, THEREFORE, in consideration of the mutual covenants and agreements set forth herein, and for " +
		"other good and valuable consideration, the receipt and sufficiency of which are hereby acknowledged, " +
		"the parties agree as follows: The Receiving Party shall hold and maintain the Confidential Information " +
		"in strict confidence for the sole and exclusive benefit of the Disclosing Party. The Receiving Party " +
		"shall not, without the prior written approval of the Disclosing Party, use for the Receiving Party's " +
		"own benefit, publish, copy, or otherwise disclose to others, or permit the use by others for their " +
		"benefit or to the detriment of the Disclosing Party, any Confidential Information. The obligations " +
		"of confidentiality shall survive the termination of this Agreement for a period of five (5) years.\n\n"
	// ~600 chars per paragraph, ~5 paragraphs per page
	repeats := pageCount * 5
	var sb strings.Builder
	sb.Grow(len(paragraph) * repeats)
	for i := 0; i < repeats; i++ {
		sb.WriteString(paragraph)
	}
	return sb.String()
}

func BenchmarkChunker_SmallDoc(b *testing.B) {
	text := generateLongText(1) // ~1 page
	chunker := NewLegacyChunkerService(768, 0.20)
	ctx := context.Background()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = chunker.Chunk(ctx, text, "bench-doc-small")
	}
}

func BenchmarkChunker_LargeDoc(b *testing.B) {
	text := generateLongText(100) // ~100 pages
	chunker := NewLegacyChunkerService(768, 0.20)
	ctx := context.Background()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = chunker.Chunk(ctx, text, "bench-doc-large")
	}
}
