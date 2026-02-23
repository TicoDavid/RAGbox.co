package cache

import (
	"testing"
	"time"
)

func TestEmbeddingCache_HitMiss(t *testing.T) {
	c := NewEmbeddingCache(1 * time.Minute)
	defer c.Stop()

	hash := EmbeddingQueryHash("test query")

	// Miss
	if _, ok := c.Get(hash); ok {
		t.Fatal("expected miss on empty cache")
	}

	// Set
	vec := []float32{0.1, 0.2, 0.3}
	c.Set(hash, vec)

	// Hit
	got, ok := c.Get(hash)
	if !ok {
		t.Fatal("expected hit after set")
	}
	if len(got) != 3 || got[0] != 0.1 || got[1] != 0.2 || got[2] != 0.3 {
		t.Fatalf("unexpected vector: %v", got)
	}
}

func TestEmbeddingCache_Expiry(t *testing.T) {
	c := NewEmbeddingCache(10 * time.Millisecond)
	defer c.Stop()

	hash := EmbeddingQueryHash("expire me")
	c.Set(hash, []float32{1.0})

	// Should hit immediately
	if _, ok := c.Get(hash); !ok {
		t.Fatal("expected hit before expiry")
	}

	// Wait for expiry
	time.Sleep(20 * time.Millisecond)
	if _, ok := c.Get(hash); ok {
		t.Fatal("expected miss after expiry")
	}
}

func TestEmbeddingCache_Len(t *testing.T) {
	c := NewEmbeddingCache(1 * time.Minute)
	defer c.Stop()

	if c.Len() != 0 {
		t.Fatalf("expected 0, got %d", c.Len())
	}

	c.Set("a", []float32{1.0})
	c.Set("b", []float32{2.0})
	if c.Len() != 2 {
		t.Fatalf("expected 2, got %d", c.Len())
	}
}

func TestEmbeddingQueryHash_Deterministic(t *testing.T) {
	h1 := EmbeddingQueryHash("What is TUMM?")
	h2 := EmbeddingQueryHash("what is tumm?")
	h3 := EmbeddingQueryHash("  What is TUMM?  ")

	if h1 != h2 {
		t.Fatalf("case-insensitive mismatch: %s != %s", h1, h2)
	}
	if h1 != h3 {
		t.Fatalf("whitespace-insensitive mismatch: %s != %s", h1, h3)
	}
}

func TestEmbeddingQueryHash_Different(t *testing.T) {
	h1 := EmbeddingQueryHash("query one")
	h2 := EmbeddingQueryHash("query two")

	if h1 == h2 {
		t.Fatal("different queries should produce different hashes")
	}
}

func TestEmbeddingCache_Roundtrip768(t *testing.T) {
	c := NewEmbeddingCache(1 * time.Minute)
	defer c.Stop()

	// Simulate a 768-dim vector
	vec := make([]float32, 768)
	for i := range vec {
		vec[i] = float32(i) * 0.001
	}

	hash := EmbeddingQueryHash("roundtrip test")
	c.Set(hash, vec)

	got, ok := c.Get(hash)
	if !ok {
		t.Fatal("expected cache hit")
	}
	if len(got) != 768 {
		t.Fatalf("expected 768 dims, got %d", len(got))
	}
	if got[0] != 0.0 || got[767] != float32(767)*0.001 {
		t.Fatalf("vector data corrupted: first=%f last=%f", got[0], got[767])
	}
}
