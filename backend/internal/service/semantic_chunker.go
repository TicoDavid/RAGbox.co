package service

import (
	"context"
	"fmt"
	"strings"
	"unicode"
)

// SemanticChunkerService splits document text on meaning boundaries instead of
// fixed token counts. Split priority: section headers → paragraph breaks →
// sentence boundaries. Implements the Chunker interface.
type SemanticChunkerService struct {
	minTokens int // target minimum tokens per chunk (512)
	maxTokens int // target maximum tokens per chunk (1024)
}

// NewSemanticChunkerService creates a SemanticChunkerService with default 512-1024 token range.
func NewSemanticChunkerService() *SemanticChunkerService {
	return &SemanticChunkerService{
		minTokens: 512,
		maxTokens: 1024,
	}
}

// semanticBlock represents a paragraph or header block from the source text.
type semanticBlock struct {
	content  string
	isHeader bool
	title    string
}

// Chunk splits text into semantically meaningful chunks.
// Implements the Chunker interface used by PipelineService.
func (s *SemanticChunkerService) Chunk(ctx context.Context, text string, docID string) ([]Chunk, error) {
	if strings.TrimSpace(text) == "" {
		return nil, fmt.Errorf("service.Chunk: text is empty")
	}

	blocks := splitSemanticBlocks(text)
	if len(blocks) == 0 {
		return nil, fmt.Errorf("service.Chunk: no content after splitting")
	}

	// Build segments respecting semantic boundaries
	segments := s.buildSemanticSegments(blocks)

	// Apply 2-sentence overlap between consecutive chunks
	overlapped := applySemanticOverlap(segments)

	// Build final Chunk structs with metadata
	var chunks []Chunk
	for _, seg := range overlapped {
		content := strings.TrimSpace(seg.content)
		if content == "" {
			continue
		}
		chunks = append(chunks, Chunk{
			Content:      content,
			ContentHash:  sha256Hash(content),
			TokenCount:   estimateTokens(content),
			Index:        0,
			DocumentID:   docID,
			PageNumber:   seg.pageNumber,
			SectionTitle: seg.sectionTitle,
		})
	}

	// Re-index after filtering empties
	for i := range chunks {
		chunks[i].Index = i
	}

	return chunks, nil
}

// splitSemanticBlocks splits text into blocks separated by double newlines,
// classifying each as a header or paragraph.
func splitSemanticBlocks(text string) []semanticBlock {
	raw := strings.Split(text, "\n\n")
	var blocks []semanticBlock
	for _, p := range raw {
		trimmed := strings.TrimSpace(p)
		if trimmed == "" {
			continue
		}
		if title := extractSectionTitle(trimmed); title != "" {
			blocks = append(blocks, semanticBlock{content: trimmed, isHeader: true, title: title})
		} else {
			blocks = append(blocks, semanticBlock{content: trimmed})
		}
	}
	return blocks
}

// buildSemanticSegments merges blocks into segments respecting meaning boundaries.
// Headers always force a new segment. Paragraphs are merged until maxTokens.
// Oversized paragraphs are split at sentence boundaries.
func (s *SemanticChunkerService) buildSemanticSegments(blocks []semanticBlock) []segment {
	var segments []segment
	var current strings.Builder
	currentSection := ""
	currentPage := 1
	pageBreakCount := 0

	flush := func() {
		if current.Len() > 0 {
			segments = append(segments, segment{
				content:      current.String(),
				sectionTitle: currentSection,
				pageNumber:   currentPage,
			})
			current.Reset()
			currentPage = 1 + pageBreakCount
		}
	}

	for _, blk := range blocks {
		// Track page breaks (form feed)
		if strings.Contains(blk.content, "\f") {
			pageBreakCount++
		}

		if blk.isHeader {
			// Headers force a new segment boundary
			flush()
			currentSection = blk.title
			current.WriteString(blk.content)
			continue
		}

		paraTokens := estimateTokens(blk.content)
		currentTokens := estimateTokens(current.String())

		// If adding this paragraph would exceed maxTokens, flush first
		if currentTokens > 0 && currentTokens+paraTokens > s.maxTokens {
			flush()
		}

		// If a single paragraph exceeds maxTokens, split by sentences
		if paraTokens > s.maxTokens {
			flush()
			for _, sub := range splitLargeParagraph(blk.content, s.maxTokens) {
				segments = append(segments, segment{
					content:      sub,
					sectionTitle: currentSection,
					pageNumber:   1 + pageBreakCount,
				})
			}
			continue
		}

		if current.Len() > 0 {
			current.WriteString("\n\n")
		}
		current.WriteString(blk.content)
	}

	flush()
	return segments
}

// applySemanticOverlap prepends the last 2 sentences of the previous chunk
// to each subsequent chunk (semantic overlap, not token-count overlap).
func applySemanticOverlap(segments []segment) []segment {
	if len(segments) <= 1 {
		return segments
	}

	result := make([]segment, len(segments))
	result[0] = segments[0]

	for i := 1; i < len(segments); i++ {
		prevSentences := splitSentencesSemantic(segments[i-1].content)
		// Fallback to simpler splitter if semantic split yields only 1 fragment
		if len(prevSentences) <= 1 {
			prevSentences = splitSentences(segments[i-1].content)
		}

		overlapCount := 2
		if overlapCount > len(prevSentences) {
			overlapCount = len(prevSentences)
		}

		var tail string
		if overlapCount > 0 {
			tail = strings.Join(prevSentences[len(prevSentences)-overlapCount:], " ")
		}

		if tail != "" {
			result[i] = segment{
				content:      tail + "\n\n" + segments[i].content,
				sectionTitle: segments[i].sectionTitle,
				pageNumber:   segments[i].pageNumber,
			}
		} else {
			result[i] = segments[i]
		}
	}

	return result
}

// splitSentencesSemantic splits text at sentence boundaries defined as
// ". ", "! ", or "? " followed by an uppercase letter.
func splitSentencesSemantic(text string) []string {
	var sentences []string
	var current strings.Builder
	runes := []rune(text)

	for i := 0; i < len(runes); i++ {
		current.WriteRune(runes[i])
		if (runes[i] == '.' || runes[i] == '!' || runes[i] == '?') &&
			i+2 < len(runes) && runes[i+1] == ' ' && unicode.IsUpper(runes[i+2]) {
			sentences = append(sentences, strings.TrimSpace(current.String()))
			current.Reset()
		}
	}
	if s := strings.TrimSpace(current.String()); s != "" {
		sentences = append(sentences, s)
	}
	return sentences
}
