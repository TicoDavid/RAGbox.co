package service

import (
	"context"
	"crypto/sha256"
	"fmt"
	"math"
	"strings"
)

// ChunkerService splits document text into overlapping chunks of configurable size.
type ChunkerService struct {
	chunkSize  int     // target tokens per chunk (default 768)
	overlapPct float64 // overlap between adjacent chunks (default 0.20)
}

// NewChunkerService creates a ChunkerService with the given parameters.
func NewChunkerService(chunkSize int, overlapPct float64) *ChunkerService {
	if chunkSize <= 0 {
		chunkSize = 768
	}
	if overlapPct <= 0 || overlapPct >= 1 {
		overlapPct = 0.20
	}
	return &ChunkerService{
		chunkSize:  chunkSize,
		overlapPct: overlapPct,
	}
}

// Chunk splits text into overlapping chunks and returns them with metadata.
// Implements the Chunker interface used by PipelineService.
func (s *ChunkerService) Chunk(ctx context.Context, text string, docID string) ([]Chunk, error) {
	if strings.TrimSpace(text) == "" {
		return nil, fmt.Errorf("service.Chunk: text is empty")
	}

	paragraphs := splitParagraphs(text)
	if len(paragraphs) == 0 {
		return nil, fmt.Errorf("service.Chunk: no content after splitting")
	}

	// Build raw segments by merging paragraphs up to chunk size,
	// splitting oversized paragraphs.
	segments := s.buildSegments(paragraphs)

	// Apply overlap: prepend tail of previous chunk to each subsequent chunk
	overlapped := s.applyOverlap(segments)

	// Build final chunks with metadata
	chunks := make([]Chunk, 0, len(overlapped))
	for i, seg := range overlapped {
		content := strings.TrimSpace(seg.content)
		if content == "" {
			continue
		}

		tokens := estimateTokens(content)
		hash := sha256Hash(content)
		section := seg.sectionTitle

		chunks = append(chunks, Chunk{
			Content:      content,
			ContentHash:  hash,
			TokenCount:   tokens,
			Index:        i,
			DocumentID:   docID,
			PageNumber:   seg.pageNumber,
			SectionTitle: section,
		})
	}

	// Re-index after filtering empties
	for i := range chunks {
		chunks[i].Index = i
	}

	return chunks, nil
}

type segment struct {
	content      string
	sectionTitle string
	pageNumber   int
}

// buildSegments merges small paragraphs and splits large ones to fit chunkSize.
func (s *ChunkerService) buildSegments(paragraphs []string) []segment {
	var segments []segment
	var current strings.Builder
	currentSection := ""
	currentPage := 1
	pageBreakCount := 0

	for _, para := range paragraphs {
		// Detect page breaks (form feed or explicit marker)
		if strings.Contains(para, "\f") {
			pageBreakCount++
		}

		// Detect section titles (markdown-style headers)
		if title := extractSectionTitle(para); title != "" {
			currentSection = title
		}

		paraTokens := estimateTokens(para)
		currentTokens := estimateTokens(current.String())

		// If adding this paragraph exceeds chunk size, flush current
		if currentTokens > 0 && currentTokens+paraTokens > s.chunkSize {
			segments = append(segments, segment{
				content:      current.String(),
				sectionTitle: currentSection,
				pageNumber:   currentPage,
			})
			current.Reset()
			currentPage = 1 + pageBreakCount
		}

		// If a single paragraph is larger than chunk size, split it
		if paraTokens > s.chunkSize {
			if current.Len() > 0 {
				segments = append(segments, segment{
					content:      current.String(),
					sectionTitle: currentSection,
					pageNumber:   currentPage,
				})
				current.Reset()
			}
			for _, sub := range splitLargeParagraph(para, s.chunkSize) {
				segments = append(segments, segment{
					content:      sub,
					sectionTitle: currentSection,
					pageNumber:   1 + pageBreakCount,
				})
			}
			currentPage = 1 + pageBreakCount
			continue
		}

		if current.Len() > 0 {
			current.WriteString("\n\n")
		}
		current.WriteString(para)
	}

	// Flush remaining
	if current.Len() > 0 {
		segments = append(segments, segment{
			content:      current.String(),
			sectionTitle: currentSection,
			pageNumber:   1 + pageBreakCount,
		})
	}

	return segments
}

// applyOverlap duplicates the last overlapPct of each chunk as prefix of the next.
func (s *ChunkerService) applyOverlap(segments []segment) []segment {
	if len(segments) <= 1 {
		return segments
	}

	result := make([]segment, len(segments))
	result[0] = segments[0]

	for i := 1; i < len(segments); i++ {
		prevContent := segments[i-1].content
		overlapWords := int(math.Ceil(float64(wordCount(prevContent)) * s.overlapPct))
		tail := lastNWords(prevContent, overlapWords)

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

// splitParagraphs splits text on double newlines into paragraphs,
// filtering out empty/whitespace-only entries.
func splitParagraphs(text string) []string {
	raw := strings.Split(text, "\n\n")
	var result []string
	for _, p := range raw {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

// splitLargeParagraph splits a paragraph that exceeds chunkSize into
// sentence-boundary-aware sub-chunks.
func splitLargeParagraph(para string, chunkSize int) []string {
	sentences := splitSentences(para)
	var chunks []string
	var current strings.Builder

	for _, sent := range sentences {
		sentTokens := estimateTokens(sent)
		currentTokens := estimateTokens(current.String())

		if currentTokens > 0 && currentTokens+sentTokens > chunkSize {
			chunks = append(chunks, current.String())
			current.Reset()
		}
		if current.Len() > 0 {
			current.WriteString(" ")
		}
		current.WriteString(sent)
	}

	if current.Len() > 0 {
		chunks = append(chunks, current.String())
	}

	// If we couldn't split by sentences (single huge sentence), split by words
	if len(chunks) == 0 && len(para) > 0 {
		chunks = splitByWords(para, chunkSize)
	}

	return chunks
}

// splitSentences does a basic sentence split on ". ", "! ", "? ".
func splitSentences(text string) []string {
	var sentences []string
	current := strings.Builder{}

	for i, r := range text {
		current.WriteRune(r)
		if (r == '.' || r == '!' || r == '?') && i+1 < len(text) && text[i+1] == ' ' {
			sentences = append(sentences, strings.TrimSpace(current.String()))
			current.Reset()
		}
	}
	if current.Len() > 0 {
		sentences = append(sentences, strings.TrimSpace(current.String()))
	}
	return sentences
}

// splitByWords splits text into chunks of approximately chunkSize tokens by word count.
func splitByWords(text string, chunkSize int) []string {
	words := strings.Fields(text)
	// Approximate: chunkSize tokens ≈ chunkSize/1.3 words
	wordsPerChunk := int(float64(chunkSize) / 1.3)
	if wordsPerChunk <= 0 {
		wordsPerChunk = 1
	}

	var chunks []string
	for i := 0; i < len(words); i += wordsPerChunk {
		end := i + wordsPerChunk
		if end > len(words) {
			end = len(words)
		}
		chunks = append(chunks, strings.Join(words[i:end], " "))
	}
	return chunks
}

// extractSectionTitle detects markdown-style headers (# Title, ## Section, etc.)
func extractSectionTitle(para string) string {
	trimmed := strings.TrimSpace(para)
	if strings.HasPrefix(trimmed, "#") {
		// Strip leading #s and spaces
		title := strings.TrimLeft(trimmed, "# ")
		if title != "" {
			return title
		}
	}
	return ""
}

// estimateTokens approximates token count as words * 1.3.
func estimateTokens(text string) int {
	if text == "" {
		return 0
	}
	words := len(strings.Fields(text))
	return int(math.Ceil(float64(words) * 1.3))
}

func wordCount(text string) int {
	return len(strings.Fields(text))
}

// lastNWords returns the last n words of text.
func lastNWords(text string, n int) string {
	words := strings.Fields(text)
	if n >= len(words) {
		return text
	}
	return strings.Join(words[len(words)-n:], " ")
}

func sha256Hash(s string) string {
	h := sha256.Sum256([]byte(s))
	return fmt.Sprintf("%x", h)
}
