package service

import (
	"context"
	"fmt"
	"strings"
)

const (
	defaultMaxIterations      = 1
	defaultConfidenceThreshold = 0.60
	citationRelevanceMin       = 0.7
)

// Generator abstracts generation for the Self-RAG loop.
type Generator interface {
	Generate(ctx context.Context, query string, chunks []RankedChunk, opts GenerateOpts) (*GenerationResult, error)
}

// ReflectionResult is the output of the Self-RAG reflection loop.
type ReflectionResult struct {
	FinalAnswer      string        `json:"finalAnswer"`
	FinalConfidence  float64       `json:"finalConfidence"`
	Citations        []CitationRef `json:"citations"`
	Iterations       int           `json:"iterations"`
	Critiques        []Critique    `json:"critiques"`
	SilenceTriggered bool          `json:"silenceTriggered"`
}

// Critique records the scoring for a single reflection iteration.
type Critique struct {
	Iteration         int     `json:"iteration"`
	RelevanceScore    float64 `json:"relevanceScore"`
	SupportScore      float64 `json:"supportScore"`
	CompletenessScore float64 `json:"completenessScore"`
	DroppedCitations  []int   `json:"droppedCitations"`
	Refinements       []string `json:"refinements"`
}

// SelfRAGService applies iterative reflection to improve generation quality.
type SelfRAGService struct {
	generator Generator
	maxIter   int
	threshold float64
}

// NewSelfRAGService creates a SelfRAGService.
func NewSelfRAGService(generator Generator, maxIter int, threshold float64) *SelfRAGService {
	if maxIter <= 0 {
		maxIter = defaultMaxIterations
	}
	if threshold <= 0 || threshold > 1 {
		threshold = defaultConfidenceThreshold
	}
	return &SelfRAGService{
		generator: generator,
		maxIter:   maxIter,
		threshold: threshold,
	}
}

// MaxIterations returns the configured maximum number of reflection iterations.
func (s *SelfRAGService) MaxIterations() int {
	return s.maxIter
}

// Threshold returns the configured confidence threshold for early exit.
func (s *SelfRAGService) Threshold() float64 {
	return s.threshold
}

// Reflect runs the Self-RAG reflection loop on an initial generation result.
// It iteratively critiques relevance, support, and completeness, dropping weak
// citations and regenerating if confidence is below threshold.
func (s *SelfRAGService) Reflect(ctx context.Context, query string, chunks []RankedChunk, initial *GenerationResult) (*ReflectionResult, error) {
	if initial == nil {
		return nil, fmt.Errorf("service.Reflect: initial result is nil")
	}

	current := initial
	var critiques []Critique

	for i := 0; i < s.maxIter; i++ {
		// 1. Relevance critique: score each citation against query
		relevanceScore, droppedIndices := critiqueRelevance(current.Citations, query, chunks)

		// 2. Filter out low-relevance citations
		filtered := filterCitations(current.Citations, droppedIndices)

		// 3. Support critique: is each claim grounded in chunks?
		supportScore := critiqueSupport(current.Answer, chunks)

		// 4. Completeness critique: does the answer address the query?
		completenessScore := critiqueCompleteness(query, current.Answer)

		// 5. Overall confidence = average of three scores
		confidence := (relevanceScore + supportScore + completenessScore) / 3.0

		var refinements []string
		if len(droppedIndices) > 0 {
			refinements = append(refinements, fmt.Sprintf("dropped %d weak citations", len(droppedIndices)))
		}
		if supportScore < 0.8 {
			refinements = append(refinements, "answer contains unsupported claims")
		}
		if completenessScore < 0.7 {
			refinements = append(refinements, "answer does not fully address query")
		}

		critiques = append(critiques, Critique{
			Iteration:         i + 1,
			RelevanceScore:    relevanceScore,
			SupportScore:      supportScore,
			CompletenessScore: completenessScore,
			DroppedCitations:  droppedIndices,
			Refinements:       refinements,
		})

		// Early exit if confidence meets threshold
		if confidence >= s.threshold {
			return &ReflectionResult{
				FinalAnswer:     current.Answer,
				FinalConfidence: confidence,
				Citations:       filtered,
				Iterations:      i + 1,
				Critiques:       critiques,
			}, nil
		}

		// If this is the last iteration, don't regenerate
		if i == s.maxIter-1 {
			break
		}

		// Regenerate with refinement instructions
		refinedQuery := buildRefinedQuery(query, refinements)
		regenerated, err := s.generator.Generate(ctx, refinedQuery, chunks, GenerateOpts{Mode: "detailed"})
		if err != nil {
			// If regeneration fails, return what we have with silence
			return &ReflectionResult{
				FinalAnswer:      current.Answer,
				FinalConfidence:  confidence,
				Citations:        filtered,
				Iterations:       i + 1,
				Critiques:        critiques,
				SilenceTriggered: confidence < s.threshold,
			}, nil
		}

		current = regenerated
	}

	// After all iterations, compute final confidence
	finalConfidence := float64(0)
	if len(critiques) > 0 {
		last := critiques[len(critiques)-1]
		finalConfidence = (last.RelevanceScore + last.SupportScore + last.CompletenessScore) / 3.0
	}

	finalCitations := filterCitations(current.Citations, nil)

	return &ReflectionResult{
		FinalAnswer:      current.Answer,
		FinalConfidence:  finalConfidence,
		Citations:        finalCitations,
		Iterations:       s.maxIter,
		Critiques:        critiques,
		SilenceTriggered: finalConfidence < s.threshold,
	}, nil
}

// critiqueRelevance scores citation relevance and identifies weak ones.
// Returns average relevance and indices of citations below threshold.
func critiqueRelevance(citations []CitationRef, query string, chunks []RankedChunk) (float64, []int) {
	if len(citations) == 0 {
		return 0.5, nil // No citations is moderate relevance
	}

	queryWords := strings.Fields(strings.ToLower(query))
	var totalScore float64
	var dropped []int

	for _, cit := range citations {
		// Use the citation's relevance score if available
		score := cit.Relevance
		if score <= 0 {
			// Estimate from keyword overlap between excerpt and query
			score = keywordOverlap(queryWords, strings.ToLower(cit.Excerpt))
		}
		totalScore += score

		if score < citationRelevanceMin {
			dropped = append(dropped, cit.Index)
		}
	}

	return totalScore / float64(len(citations)), dropped
}

// critiqueSupport scores how well the answer's claims are grounded in chunks.
func critiqueSupport(answer string, chunks []RankedChunk) float64 {
	if answer == "" || len(chunks) == 0 {
		return 0.0
	}

	// Heuristic: check what fraction of answer sentences have supporting chunk content
	sentences := splitAnswerSentences(answer)
	if len(sentences) == 0 {
		return 0.5
	}

	allChunkContent := ""
	for _, c := range chunks {
		allChunkContent += " " + strings.ToLower(c.Chunk.Content)
	}

	supported := 0
	for _, sent := range sentences {
		sentLower := strings.ToLower(sent)
		words := strings.Fields(sentLower)
		matchCount := 0
		for _, w := range words {
			w = stripPunctuation(w)
			if len(w) > 3 && strings.Contains(allChunkContent, w) {
				matchCount++
			}
		}
		if len(words) > 0 && float64(matchCount)/float64(len(words)) > 0.3 {
			supported++
		}
	}

	return float64(supported) / float64(len(sentences))
}

// critiqueCompleteness scores whether the answer fully addresses the query.
func critiqueCompleteness(query, answer string) float64 {
	if answer == "" {
		return 0.0
	}

	queryWords := strings.Fields(strings.ToLower(query))
	answerLower := strings.ToLower(answer)

	if len(queryWords) == 0 {
		return 1.0
	}

	// Count how many query keywords appear in the answer (stem-aware via prefix match)
	checked := 0
	found := 0
	for _, w := range queryWords {
		w = stripPunctuation(w)
		if len(w) <= 2 {
			continue // skip stop words like "is", "a", etc.
		}
		checked++
		// Use prefix matching to handle stemming: "expire" matches "expires"
		stem := w
		if len(stem) > 4 {
			stem = stem[:len(stem)-1] // simple stem: drop last char
		}
		if strings.Contains(answerLower, stem) {
			found++
		}
	}

	if checked == 0 {
		return 1.0
	}

	score := float64(found) / float64(checked)

	// Boost if answer is reasonably long
	answerWords := len(strings.Fields(answer))
	if answerWords > 20 {
		score = score*0.8 + 0.2
	}

	if score > 1.0 {
		score = 1.0
	}

	return score
}

// filterCitations removes citations whose indices are in the dropped list.
func filterCitations(citations []CitationRef, droppedIndices []int) []CitationRef {
	if len(droppedIndices) == 0 {
		// Return a copy
		result := make([]CitationRef, len(citations))
		copy(result, citations)
		return result
	}

	droppedSet := make(map[int]bool, len(droppedIndices))
	for _, idx := range droppedIndices {
		droppedSet[idx] = true
	}

	var result []CitationRef
	for _, c := range citations {
		if !droppedSet[c.Index] {
			result = append(result, c)
		}
	}

	if result == nil {
		result = []CitationRef{}
	}
	return result
}

// keywordOverlap computes the fraction of query words found in the text.
func keywordOverlap(queryWords []string, text string) float64 {
	if len(queryWords) == 0 {
		return 0.5
	}
	found := 0
	for _, w := range queryWords {
		w = stripPunctuation(w)
		if len(w) > 2 && strings.Contains(text, w) {
			found++
		}
	}
	return float64(found) / float64(len(queryWords))
}

// stripPunctuation removes leading/trailing punctuation from a word.
func stripPunctuation(w string) string {
	return strings.TrimFunc(w, func(r rune) bool {
		return r == '.' || r == ',' || r == '!' || r == '?' || r == ';' || r == ':' || r == '"' || r == '\'' || r == '(' || r == ')' || r == '[' || r == ']'
	})
}

// splitAnswerSentences splits an answer into sentences on ". ", "! ", "? ".
func splitAnswerSentences(answer string) []string {
	var sentences []string
	var current strings.Builder

	for i, r := range answer {
		current.WriteRune(r)
		if (r == '.' || r == '!' || r == '?') && i+1 < len(answer) && answer[i+1] == ' ' {
			s := strings.TrimSpace(current.String())
			if s != "" {
				sentences = append(sentences, s)
			}
			current.Reset()
		}
	}
	if s := strings.TrimSpace(current.String()); s != "" {
		sentences = append(sentences, s)
	}
	return sentences
}

// buildRefinedQuery appends refinement instructions to the original query.
func buildRefinedQuery(query string, refinements []string) string {
	if len(refinements) == 0 {
		return query
	}
	return query + "\n\n[REFINEMENT INSTRUCTIONS: " + strings.Join(refinements, "; ") + ". Please improve your answer accordingly.]"
}
