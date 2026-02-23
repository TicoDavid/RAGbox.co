// Package cache provides in-memory caching for the RAG pipeline.
//
// EmbeddingCache stores query→vector mappings to avoid redundant
// Vertex AI embedding calls for repeated or similar queries.
package cache

import (
	"crypto/sha256"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// EmbeddingCache caches query embedding vectors keyed by normalized query hash.
// Thread-safe via sync.RWMutex. Entries auto-expire after TTL.
type EmbeddingCache struct {
	mu      sync.RWMutex
	entries map[string]*embeddingEntry
	ttl     time.Duration
	stopCh  chan struct{}
}

type embeddingEntry struct {
	vec       []float32
	createdAt time.Time
	expiresAt time.Time
}

// DefaultEmbeddingTTL is 15 minutes unless overridden by EMBEDDING_CACHE_TTL env var.
func DefaultEmbeddingTTL() time.Duration {
	if v := os.Getenv("EMBEDDING_CACHE_TTL"); v != "" {
		if secs, err := strconv.Atoi(v); err == nil && secs > 0 {
			return time.Duration(secs) * time.Second
		}
	}
	return 15 * time.Minute
}

// NewEmbeddingCache creates an EmbeddingCache with the given TTL and starts background cleanup.
func NewEmbeddingCache(ttl time.Duration) *EmbeddingCache {
	c := &EmbeddingCache{
		entries: make(map[string]*embeddingEntry),
		ttl:     ttl,
		stopCh:  make(chan struct{}),
	}
	go c.cleanup()
	return c
}

// Get returns a cached embedding vector if present and not expired.
func (c *EmbeddingCache) Get(queryHash string) ([]float32, bool) {
	c.mu.RLock()
	entry, ok := c.entries[queryHash]
	c.mu.RUnlock()

	if !ok {
		return nil, false
	}
	if time.Now().After(entry.expiresAt) {
		c.mu.Lock()
		delete(c.entries, queryHash)
		c.mu.Unlock()
		return nil, false
	}

	slog.Info("[EMBED-CACHE] hit",
		"query_hash", queryHash,
		"age_ms", time.Since(entry.createdAt).Milliseconds(),
	)
	return entry.vec, true
}

// Set stores an embedding vector in the cache.
func (c *EmbeddingCache) Set(queryHash string, vec []float32) {
	now := time.Now()
	c.mu.Lock()
	c.entries[queryHash] = &embeddingEntry{
		vec:       vec,
		createdAt: now,
		expiresAt: now.Add(c.ttl),
	}
	c.mu.Unlock()

	slog.Info("[EMBED-CACHE] set",
		"query_hash", queryHash,
		"vec_dim", len(vec),
		"ttl_s", int(c.ttl.Seconds()),
	)
}

// Len returns the number of entries in the cache.
func (c *EmbeddingCache) Len() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.entries)
}

// Stop halts the background cleanup goroutine.
func (c *EmbeddingCache) Stop() {
	close(c.stopCh)
}

// cleanup removes expired entries every 5 minutes.
func (c *EmbeddingCache) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			now := time.Now()
			c.mu.Lock()
			before := len(c.entries)
			for key, entry := range c.entries {
				if now.After(entry.expiresAt) {
					delete(c.entries, key)
				}
			}
			after := len(c.entries)
			c.mu.Unlock()
			if before != after {
				slog.Info("[EMBED-CACHE] cleanup", "removed", before-after, "remaining", after)
			}
		case <-c.stopCh:
			return
		}
	}
}

// EmbeddingQueryHash returns a deterministic cache key for a query string.
// Normalizes by lowercasing and trimming whitespace before hashing.
func EmbeddingQueryHash(query string) string {
	normalized := strings.ToLower(strings.TrimSpace(query))
	h := sha256.Sum256([]byte(normalized))
	return fmt.Sprintf("emb:%x", h[:16])
}
