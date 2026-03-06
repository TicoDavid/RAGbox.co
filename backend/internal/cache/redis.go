// Package cache — Redis L2 cache for cross-instance sharing.
// EPIC-028: Reduces TTFB for repeated queries to <500ms.
package cache

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/connexus-ai/ragbox-backend/internal/service"
)

// RedisCache provides an L2 cache backed by Redis.
// Used alongside in-memory caches: L1 (in-memory) → L2 (Redis) → compute.
type RedisCache struct {
	client *redis.Client

	// TTLs for different cache tiers
	EmbedTTL     time.Duration // query embedding vectors
	RetrievalTTL time.Duration // retrieval results (chunks)
	ResponseTTL  time.Duration // full generation responses
}

// cachedResponse is the JSON-serializable form stored in Redis for full responses.
type cachedResponse struct {
	Answer     string             `json:"answer"`
	Citations  []service.CitationRef `json:"citations"`
	Confidence float64            `json:"confidence"`
	ModelUsed  string             `json:"model_used"`
}

// NewRedisCache connects to Redis and returns an L2 cache.
// Returns nil (not an error) if addr is empty — Redis is optional.
func NewRedisCache(addr string) *RedisCache {
	if addr == "" {
		return nil
	}

	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		DB:           0,
		DialTimeout:  2 * time.Second,
		ReadTimeout:  1 * time.Second,
		WriteTimeout: 1 * time.Second,
		PoolSize:     10,
	})

	// Ping to verify connectivity (non-fatal)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		slog.Warn("[REDIS] connection failed (operating without L2 cache)", "addr", addr, "error", err)
		client.Close()
		return nil
	}

	slog.Info("[REDIS] connected", "addr", addr)

	return &RedisCache{
		client:       client,
		EmbedTTL:     10 * time.Minute,
		RetrievalTTL: 5 * time.Minute,
		ResponseTTL:  2 * time.Minute,
	}
}

// Close shuts down the Redis connection.
func (rc *RedisCache) Close() error {
	if rc == nil {
		return nil
	}
	return rc.client.Close()
}

// --- Embedding cache (L2) ---

func embedRedisKey(queryHash string) string {
	return "rc:emb:" + queryHash
}

// GetEmbedding returns a cached embedding vector from Redis.
func (rc *RedisCache) GetEmbedding(ctx context.Context, queryHash string) ([]float32, bool) {
	if rc == nil {
		return nil, false
	}
	data, err := rc.client.Get(ctx, embedRedisKey(queryHash)).Bytes()
	if err != nil {
		return nil, false
	}
	var vec []float32
	if err := json.Unmarshal(data, &vec); err != nil {
		return nil, false
	}
	slog.Info("[REDIS] embed hit", "query_hash", queryHash)
	return vec, true
}

// SetEmbedding stores an embedding vector in Redis.
func (rc *RedisCache) SetEmbedding(ctx context.Context, queryHash string, vec []float32) {
	if rc == nil {
		return
	}
	data, err := json.Marshal(vec)
	if err != nil {
		return
	}
	rc.client.Set(ctx, embedRedisKey(queryHash), data, rc.EmbedTTL)
}

// --- Retrieval result cache (L2) ---

func retrievalRedisKey(userID, query string, privilegeMode bool) string {
	h := sha256.Sum256([]byte(query))
	return fmt.Sprintf("rc:ret:%s:%v:%x", userID, privilegeMode, h[:8])
}

// GetRetrieval returns cached retrieval results from Redis.
func (rc *RedisCache) GetRetrieval(ctx context.Context, userID, query string, privilegeMode bool) (*service.RetrievalResult, bool) {
	if rc == nil {
		return nil, false
	}
	data, err := rc.client.Get(ctx, retrievalRedisKey(userID, query, privilegeMode)).Bytes()
	if err != nil {
		return nil, false
	}
	var result service.RetrievalResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, false
	}
	slog.Info("[REDIS] retrieval hit", "user_id", userID)
	return &result, true
}

// SetRetrieval stores retrieval results in Redis.
func (rc *RedisCache) SetRetrieval(ctx context.Context, userID, query string, privilegeMode bool, result *service.RetrievalResult) {
	if rc == nil {
		return
	}
	data, err := json.Marshal(result)
	if err != nil {
		return
	}
	rc.client.Set(ctx, retrievalRedisKey(userID, query, privilegeMode), data, rc.RetrievalTTL)
}

// --- Full response cache (L2) ---

func responseRedisKey(userID, query string, privilegeMode bool) string {
	h := sha256.Sum256([]byte(query))
	return fmt.Sprintf("rc:resp:%s:%v:%x", userID, privilegeMode, h[:8])
}

// GetResponse returns a cached generation result from Redis.
func (rc *RedisCache) GetResponse(ctx context.Context, userID, query string, privilegeMode bool) (*service.GenerationResult, bool) {
	if rc == nil {
		return nil, false
	}
	data, err := rc.client.Get(ctx, responseRedisKey(userID, query, privilegeMode)).Bytes()
	if err != nil {
		return nil, false
	}
	var cr cachedResponse
	if err := json.Unmarshal(data, &cr); err != nil {
		return nil, false
	}
	slog.Info("[REDIS] response hit", "user_id", userID)
	return &service.GenerationResult{
		Answer:     cr.Answer,
		Citations:  cr.Citations,
		Confidence: cr.Confidence,
		ModelUsed:  cr.ModelUsed,
	}, true
}

// SetResponse stores a generation result in Redis.
func (rc *RedisCache) SetResponse(ctx context.Context, userID, query string, privilegeMode bool, result *service.GenerationResult) {
	if rc == nil {
		return
	}
	cr := cachedResponse{
		Answer:     result.Answer,
		Citations:  result.Citations,
		Confidence: result.Confidence,
		ModelUsed:  result.ModelUsed,
	}
	data, err := json.Marshal(cr)
	if err != nil {
		return
	}
	rc.client.Set(ctx, responseRedisKey(userID, query, privilegeMode), data, rc.ResponseTTL)
}

// InvalidateUser removes all cached entries for a user across all tiers.
func (rc *RedisCache) InvalidateUser(ctx context.Context, userID string) {
	if rc == nil {
		return
	}
	// Scan for keys matching this user's retrieval and response caches
	patterns := []string{
		fmt.Sprintf("rc:ret:%s:*", userID),
		fmt.Sprintf("rc:resp:%s:*", userID),
	}
	for _, pattern := range patterns {
		iter := rc.client.Scan(ctx, 0, pattern, 100).Iterator()
		for iter.Next(ctx) {
			rc.client.Del(ctx, iter.Val())
		}
	}
}
