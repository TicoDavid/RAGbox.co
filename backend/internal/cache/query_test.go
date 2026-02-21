package cache

import (
	"testing"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/model"
	"github.com/connexus-ai/ragbox-backend/internal/service"
)

func makeResult(docName string) *service.RetrievalResult {
	return &service.RetrievalResult{
		Chunks: []service.RankedChunk{
			{
				Chunk:      model.DocumentChunk{ID: "chunk-1", Content: "test content"},
				Similarity: 0.85,
				FinalScore: 0.90,
				Document:   model.Document{ID: "doc-1", OriginalName: docName},
			},
		},
		TotalCandidates:     20,
		TotalDocumentsFound: 3,
	}
}

func TestQueryCache_GetSet(t *testing.T) {
	c := New(1 * time.Hour)
	defer c.Stop()

	// Miss on empty cache
	_, ok := c.Get("user-1", "what is revenue?", false)
	if ok {
		t.Fatal("expected cache miss on empty cache")
	}

	// Set and hit
	result := makeResult("revenue.pdf")
	c.Set("user-1", "what is revenue?", false, result)

	got, ok := c.Get("user-1", "what is revenue?", false)
	if !ok {
		t.Fatal("expected cache hit")
	}
	if len(got.Chunks) != 1 || got.Chunks[0].Document.OriginalName != "revenue.pdf" {
		t.Fatalf("unexpected cached result: %+v", got)
	}
}

func TestQueryCache_PrivilegeModeSeparation(t *testing.T) {
	c := New(1 * time.Hour)
	defer c.Stop()

	c.Set("user-1", "query", false, makeResult("public.pdf"))
	c.Set("user-1", "query", true, makeResult("privileged.pdf"))

	got, ok := c.Get("user-1", "query", false)
	if !ok || got.Chunks[0].Document.OriginalName != "public.pdf" {
		t.Fatal("privilege=false returned wrong result")
	}

	got, ok = c.Get("user-1", "query", true)
	if !ok || got.Chunks[0].Document.OriginalName != "privileged.pdf" {
		t.Fatal("privilege=true returned wrong result")
	}
}

func TestQueryCache_UserIsolation(t *testing.T) {
	c := New(1 * time.Hour)
	defer c.Stop()

	c.Set("user-1", "query", false, makeResult("user1.pdf"))

	_, ok := c.Get("user-2", "query", false)
	if ok {
		t.Fatal("user-2 should not see user-1's cache")
	}
}

func TestQueryCache_Expiry(t *testing.T) {
	c := New(50 * time.Millisecond)
	defer c.Stop()

	c.Set("user-1", "query", false, makeResult("test.pdf"))

	// Hit immediately
	_, ok := c.Get("user-1", "query", false)
	if !ok {
		t.Fatal("expected cache hit before expiry")
	}

	// Wait for expiry
	time.Sleep(80 * time.Millisecond)

	_, ok = c.Get("user-1", "query", false)
	if ok {
		t.Fatal("expected cache miss after expiry")
	}
}

func TestQueryCache_InvalidateUser(t *testing.T) {
	c := New(1 * time.Hour)
	defer c.Stop()

	c.Set("user-1", "query-a", false, makeResult("a.pdf"))
	c.Set("user-1", "query-b", false, makeResult("b.pdf"))
	c.Set("user-2", "query-a", false, makeResult("other.pdf"))

	if c.Len() != 3 {
		t.Fatalf("expected 3 entries, got %d", c.Len())
	}

	c.InvalidateUser("user-1")

	if c.Len() != 1 {
		t.Fatalf("expected 1 entry after invalidation, got %d", c.Len())
	}

	_, ok := c.Get("user-1", "query-a", false)
	if ok {
		t.Fatal("user-1 cache should be invalidated")
	}

	_, ok = c.Get("user-2", "query-a", false)
	if !ok {
		t.Fatal("user-2 cache should survive")
	}
}

func TestQueryCache_Len(t *testing.T) {
	c := New(1 * time.Hour)
	defer c.Stop()

	if c.Len() != 0 {
		t.Fatal("expected empty cache")
	}

	c.Set("u1", "q1", false, makeResult("a.pdf"))
	c.Set("u1", "q2", false, makeResult("b.pdf"))

	if c.Len() != 2 {
		t.Fatalf("expected 2, got %d", c.Len())
	}
}

func TestCacheKey_Deterministic(t *testing.T) {
	k1 := cacheKey("user-1", "hello world", false)
	k2 := cacheKey("user-1", "hello world", false)
	if k1 != k2 {
		t.Fatalf("cache key should be deterministic: %s != %s", k1, k2)
	}

	k3 := cacheKey("user-1", "hello world", true)
	if k1 == k3 {
		t.Fatal("different privilegeMode should produce different key")
	}

	k4 := cacheKey("user-2", "hello world", false)
	if k1 == k4 {
		t.Fatal("different userID should produce different key")
	}
}
