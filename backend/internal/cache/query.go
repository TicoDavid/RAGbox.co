// Package cache provides in-memory query result caching for the RAG pipeline.
package cache

import (
	"crypto/sha256"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// QueryCache caches RetrievalResult by (userID, query, privilegeMode).
// Thread-safe via sync.RWMutex. Entries auto-expire after TTL.
type QueryCache struct {
	mu      sync.RWMutex
	entries map[string]*cacheEntry
	ttl     time.Duration
	stopCh  chan struct{}
}

type cacheEntry struct {
	result    *service.RetrievalResult
	createdAt time.Time
	expiresAt time.Time
}

// New creates a QueryCache with the given TTL and starts background cleanup.
func New(ttl time.Duration) *QueryCache {
	c := &QueryCache{
		entries: make(map[string]*cacheEntry),
		ttl:     ttl,
		stopCh:  make(chan struct{}),
	}
	go c.cleanup()
	return c
}

// Get returns a cached RetrievalResult if present and not expired.
func (c *QueryCache) Get(userID, query string, privilegeMode bool) (*service.RetrievalResult, bool) {
	key := cacheKey(userID, query, privilegeMode)
	c.mu.RLock()
	entry, ok := c.entries[key]
	c.mu.RUnlock()

	if !ok {
		return nil, false
	}
	if time.Now().After(entry.expiresAt) {
		c.mu.Lock()
		delete(c.entries, key)
		c.mu.Unlock()
		return nil, false
	}

	slog.Info("[CACHE] hit",
		"user_id", userID,
		"query_hash", key[strings.LastIndex(key, ":")+1:],
		"age_ms", time.Since(entry.createdAt).Milliseconds(),
	)
	return entry.result, true
}

// Set stores a RetrievalResult in the cache.
func (c *QueryCache) Set(userID, query string, privilegeMode bool, result *service.RetrievalResult) {
	key := cacheKey(userID, query, privilegeMode)
	now := time.Now()
	c.mu.Lock()
	c.entries[key] = &cacheEntry{
		result:    result,
		createdAt: now,
		expiresAt: now.Add(c.ttl),
	}
	c.mu.Unlock()

	slog.Info("[CACHE] set",
		"user_id", userID,
		"query_hash", key[strings.LastIndex(key, ":")+1:],
		"ttl_s", int(c.ttl.Seconds()),
		"total_entries", c.Len(),
	)
}

// InvalidateUser removes all cached entries for a user.
// Call this when documents are uploaded, deleted, or re-indexed.
func (c *QueryCache) InvalidateUser(userID string) {
	prefix := "qc:" + userID + ":"
	c.mu.Lock()
	count := 0
	for key := range c.entries {
		if strings.HasPrefix(key, prefix) {
			delete(c.entries, key)
			count++
		}
	}
	c.mu.Unlock()

	if count > 0 {
		slog.Info("[CACHE] invalidated user",
			"user_id", userID,
			"entries_removed", count,
		)
	}
}

// Len returns the number of entries in the cache.
func (c *QueryCache) Len() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.entries)
}

// Stop halts the background cleanup goroutine.
func (c *QueryCache) Stop() {
	close(c.stopCh)
}

// cleanup removes expired entries every 5 minutes.
func (c *QueryCache) cleanup() {
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
				slog.Info("[CACHE] cleanup", "removed", before-after, "remaining", after)
			}
		case <-c.stopCh:
			return
		}
	}
}

// cacheKey builds a deterministic key: "qc:{userID}:{privilegeMode}:{sha256(query)}"
func cacheKey(userID, query string, privilegeMode bool) string {
	h := sha256.Sum256([]byte(query))
	return fmt.Sprintf("qc:%s:%v:%x", userID, privilegeMode, h[:8])
}
