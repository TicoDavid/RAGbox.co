package service

import (
	"context"
	"fmt"
	"math"
)

const (
	// maxBatchSize is the max texts per Vertex AI embedding API call.
	maxBatchSize = 250
	// embeddingDimensions is the expected vector dimensionality.
	embeddingDimensions = 768
)

// EmbeddingClient abstracts the Vertex AI embedding API for testability.
type EmbeddingClient interface {
	EmbedTexts(ctx context.Context, texts []string) ([][]float32, error)
}

// ChunkStore abstracts bulk insertion of chunks with vectors.
type ChunkStore interface {
	BulkInsert(ctx context.Context, chunks []Chunk, vectors [][]float32) error
}

// EmbedderService generates vector embeddings and stores them with chunks.
type EmbedderService struct {
	client     EmbeddingClient
	chunkStore ChunkStore
}

// NewEmbedderService creates an EmbedderService.
func NewEmbedderService(client EmbeddingClient, chunkStore ChunkStore) *EmbedderService {
	return &EmbedderService{
		client:     client,
		chunkStore: chunkStore,
	}
}

// Embed generates embeddings for a slice of texts, batching as needed.
// Returns one 768-dim L2-normalized vector per input text.
func (s *EmbedderService) Embed(ctx context.Context, texts []string) ([][]float32, error) {
	if len(texts) == 0 {
		return nil, fmt.Errorf("service.Embed: no texts provided")
	}

	allVectors := make([][]float32, 0, len(texts))

	for i := 0; i < len(texts); i += maxBatchSize {
		end := i + maxBatchSize
		if end > len(texts) {
			end = len(texts)
		}
		batch := texts[i:end]

		vectors, err := s.client.EmbedTexts(ctx, batch)
		if err != nil {
			return nil, fmt.Errorf("service.Embed: batch %d-%d: %w", i, end, err)
		}

		// Validate dimensions and L2-normalize
		for j, vec := range vectors {
			if len(vec) != embeddingDimensions {
				return nil, fmt.Errorf("service.Embed: vector %d has %d dimensions, want %d", i+j, len(vec), embeddingDimensions)
			}
			vectors[j] = l2Normalize(vec)
		}

		allVectors = append(allVectors, vectors...)
	}

	if len(allVectors) != len(texts) {
		return nil, fmt.Errorf("service.Embed: got %d vectors for %d texts", len(allVectors), len(texts))
	}

	return allVectors, nil
}

// EmbedAndStore generates embeddings for chunks and persists them via ChunkStore.
// Implements the Embedder interface used by PipelineService.
func (s *EmbedderService) EmbedAndStore(ctx context.Context, chunks []Chunk) error {
	if len(chunks) == 0 {
		return nil
	}

	texts := make([]string, len(chunks))
	for i, c := range chunks {
		texts[i] = c.Content
	}

	vectors, err := s.Embed(ctx, texts)
	if err != nil {
		return fmt.Errorf("service.EmbedAndStore: %w", err)
	}

	if err := s.chunkStore.BulkInsert(ctx, chunks, vectors); err != nil {
		return fmt.Errorf("service.EmbedAndStore: store: %w", err)
	}

	return nil
}

// l2Normalize normalizes a vector to unit length (L2 norm = 1).
func l2Normalize(vec []float32) []float32 {
	var sumSq float64
	for _, v := range vec {
		sumSq += float64(v) * float64(v)
	}
	norm := math.Sqrt(sumSq)
	if norm == 0 {
		return vec
	}

	result := make([]float32, len(vec))
	for i, v := range vec {
		result[i] = float32(float64(v) / norm)
	}
	return result
}
