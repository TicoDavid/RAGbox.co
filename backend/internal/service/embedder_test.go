package service

import (
	"context"
	"fmt"
	"math"
	"testing"
)

// mockEmbeddingClient implements EmbeddingClient for testing.
type mockEmbeddingClient struct {
	vectors [][]float32
	err     error
	calls   int
}

func (m *mockEmbeddingClient) EmbedTexts(ctx context.Context, texts []string) ([][]float32, error) {
	m.calls++
	if m.err != nil {
		return nil, m.err
	}
	// Return vectors matching the batch size
	result := make([][]float32, len(texts))
	for i := range texts {
		if i < len(m.vectors) {
			result[i] = m.vectors[i]
		} else {
			// Generate a dummy 768-dim vector
			vec := make([]float32, 768)
			vec[0] = float32(i + 1)
			vec[1] = 0.5
			result[i] = vec
		}
	}
	return result, nil
}

// mockChunkStore implements ChunkStore for testing.
type mockChunkStore struct {
	insertedChunks  []Chunk
	insertedVectors [][]float32
	err             error
}

func (m *mockChunkStore) BulkInsert(ctx context.Context, chunks []Chunk, vectors [][]float32) error {
	m.insertedChunks = chunks
	m.insertedVectors = vectors
	return m.err
}

func TestEmbed_Success(t *testing.T) {
	vec := make([]float32, 768)
	vec[0] = 1.0
	client := &mockEmbeddingClient{vectors: [][]float32{vec}}
	svc := NewEmbedderService(client, nil)

	vectors, err := svc.Embed(context.Background(), []string{"hello world"})
	if err != nil {
		t.Fatalf("Embed() error: %v", err)
	}

	if len(vectors) != 1 {
		t.Fatalf("expected 1 vector, got %d", len(vectors))
	}
	if len(vectors[0]) != 768 {
		t.Errorf("vector dimensions = %d, want 768", len(vectors[0]))
	}
}

func TestEmbed_L2Normalized(t *testing.T) {
	vec := make([]float32, 768)
	vec[0] = 3.0
	vec[1] = 4.0
	client := &mockEmbeddingClient{vectors: [][]float32{vec}}
	svc := NewEmbedderService(client, nil)

	vectors, err := svc.Embed(context.Background(), []string{"test"})
	if err != nil {
		t.Fatalf("Embed() error: %v", err)
	}

	// Check L2 norm ≈ 1.0
	var sumSq float64
	for _, v := range vectors[0] {
		sumSq += float64(v) * float64(v)
	}
	norm := math.Sqrt(sumSq)
	if math.Abs(norm-1.0) > 0.001 {
		t.Errorf("L2 norm = %f, want ~1.0", norm)
	}
}

func TestEmbed_Batching(t *testing.T) {
	client := &mockEmbeddingClient{}
	svc := NewEmbedderService(client, nil)

	// 300 texts should require 2 API calls (250 + 50)
	texts := make([]string, 300)
	for i := range texts {
		texts[i] = fmt.Sprintf("text %d", i)
	}

	vectors, err := svc.Embed(context.Background(), texts)
	if err != nil {
		t.Fatalf("Embed() error: %v", err)
	}

	if len(vectors) != 300 {
		t.Errorf("expected 300 vectors, got %d", len(vectors))
	}

	if client.calls != 2 {
		t.Errorf("expected 2 API calls (batch of 250 + 50), got %d", client.calls)
	}
}

func TestEmbed_EmptyInput(t *testing.T) {
	client := &mockEmbeddingClient{}
	svc := NewEmbedderService(client, nil)

	_, err := svc.Embed(context.Background(), []string{})
	if err == nil {
		t.Fatal("expected error for empty input")
	}
}

func TestEmbed_ClientError(t *testing.T) {
	client := &mockEmbeddingClient{err: fmt.Errorf("API rate limit exceeded")}
	svc := NewEmbedderService(client, nil)

	_, err := svc.Embed(context.Background(), []string{"test"})
	if err == nil {
		t.Fatal("expected error when client fails")
	}
}

func TestEmbed_WrongDimensions(t *testing.T) {
	// Return a 512-dim vector instead of 768
	vec := make([]float32, 512)
	client := &mockEmbeddingClient{vectors: [][]float32{vec}}
	svc := NewEmbedderService(client, nil)

	_, err := svc.Embed(context.Background(), []string{"test"})
	if err == nil {
		t.Fatal("expected error for wrong dimensions")
	}
}

func TestEmbedAndStore_Success(t *testing.T) {
	vec := make([]float32, 768)
	vec[0] = 1.0
	client := &mockEmbeddingClient{vectors: [][]float32{vec, vec}}
	store := &mockChunkStore{}
	svc := NewEmbedderService(client, store)

	chunks := []Chunk{
		{Content: "chunk 1", DocumentID: "doc-1", Index: 0},
		{Content: "chunk 2", DocumentID: "doc-1", Index: 1},
	}

	err := svc.EmbedAndStore(context.Background(), chunks)
	if err != nil {
		t.Fatalf("EmbedAndStore() error: %v", err)
	}

	if len(store.insertedChunks) != 2 {
		t.Errorf("stored %d chunks, want 2", len(store.insertedChunks))
	}
	if len(store.insertedVectors) != 2 {
		t.Errorf("stored %d vectors, want 2", len(store.insertedVectors))
	}
}

func TestEmbedAndStore_EmptyChunks(t *testing.T) {
	client := &mockEmbeddingClient{}
	store := &mockChunkStore{}
	svc := NewEmbedderService(client, store)

	err := svc.EmbedAndStore(context.Background(), []Chunk{})
	if err != nil {
		t.Fatalf("EmbedAndStore() should succeed for empty chunks: %v", err)
	}
}

func TestEmbedAndStore_StoreError(t *testing.T) {
	vec := make([]float32, 768)
	client := &mockEmbeddingClient{vectors: [][]float32{vec}}
	store := &mockChunkStore{err: fmt.Errorf("database error")}
	svc := NewEmbedderService(client, store)

	chunks := []Chunk{{Content: "chunk 1", DocumentID: "doc-1", Index: 0}}

	err := svc.EmbedAndStore(context.Background(), chunks)
	if err == nil {
		t.Fatal("expected error when store fails")
	}
}

func TestL2Normalize(t *testing.T) {
	vec := []float32{3.0, 4.0, 0, 0, 0}
	result := l2Normalize(vec)

	// Expected: [3/5, 4/5, 0, 0, 0] = [0.6, 0.8, 0, 0, 0]
	if math.Abs(float64(result[0])-0.6) > 0.001 {
		t.Errorf("result[0] = %f, want ~0.6", result[0])
	}
	if math.Abs(float64(result[1])-0.8) > 0.001 {
		t.Errorf("result[1] = %f, want ~0.8", result[1])
	}
}

func TestL2Normalize_ZeroVector(t *testing.T) {
	vec := []float32{0, 0, 0}
	result := l2Normalize(vec)
	// Should return original (no division by zero)
	if result[0] != 0 || result[1] != 0 || result[2] != 0 {
		t.Error("zero vector should remain zero")
	}
}

func TestEmbed_ExactBatchBoundary(t *testing.T) {
	client := &mockEmbeddingClient{}
	svc := NewEmbedderService(client, nil)

	// Exactly 250 texts — should be 1 API call
	texts := make([]string, 250)
	for i := range texts {
		texts[i] = fmt.Sprintf("text %d", i)
	}

	vectors, err := svc.Embed(context.Background(), texts)
	if err != nil {
		t.Fatalf("Embed() error: %v", err)
	}

	if len(vectors) != 250 {
		t.Errorf("expected 250 vectors, got %d", len(vectors))
	}
	if client.calls != 1 {
		t.Errorf("expected 1 API call for 250 texts, got %d", client.calls)
	}
}
