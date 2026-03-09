package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisClient wraps go-redis for worker cache operations.
type RedisClient struct {
	rdb *redis.Client
}

// NewRedisClient creates a Redis client from REDIS_ADDR env var.
func NewRedisClient(addr string) *RedisClient {
	rdb := redis.NewClient(&redis.Options{
		Addr: addr,
	})
	return &RedisClient{rdb: rdb}
}

// Close shuts down the Redis client.
func (c *RedisClient) Close() error {
	return c.rdb.Close()
}

// Ping checks Redis connectivity.
func (c *RedisClient) Ping(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}

// IncrEmbedProgress increments the embed progress counter for a document.
// Returns the new counter value.
func (c *RedisClient) IncrEmbedProgress(ctx context.Context, documentID string) (int64, error) {
	key := fmt.Sprintf("embed:progress:%s", documentID)
	val, err := c.rdb.Incr(ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("redis.IncrEmbedProgress: %w", err)
	}
	// Set TTL on first increment (1 hour safety net)
	if val == 1 {
		c.rdb.Expire(ctx, key, 1*time.Hour)
	}
	return val, nil
}

// InvalidateQueryCache deletes all query cache keys for a tenant.
func (c *RedisClient) InvalidateQueryCache(ctx context.Context, tenantID string) {
	keys, err := c.rdb.Keys(ctx, "ragbox:query:*").Result()
	if err != nil {
		slog.Error("redis: scan query keys failed", "error", err)
		return
	}
	if len(keys) > 0 {
		c.rdb.Del(ctx, keys...)
		slog.Info("redis: invalidated query cache", "keys", len(keys), "tenant_id", tenantID)
	}
}

// InvalidateDocCache deletes the document metadata cache entry.
func (c *RedisClient) InvalidateDocCache(ctx context.Context, documentID string) {
	c.rdb.Del(ctx, fmt.Sprintf("cache:doc:%s", documentID))
}

// SetVaultStats stores pre-computed vault stats with a 60-second TTL.
func (c *RedisClient) SetVaultStats(ctx context.Context, tenantID string, stats interface{}) {
	data, err := json.Marshal(stats)
	if err != nil {
		slog.Error("redis: marshal vault stats failed", "error", err)
		return
	}
	c.rdb.Set(ctx, fmt.Sprintf("cache:stats:%s", tenantID), data, 60*time.Second)
}

// VaultStats holds pre-computed document stats for a tenant.
type VaultStats struct {
	DocumentCount int `json:"document_count"`
	ChunkCount    int `json:"chunk_count"`
	EntityCount   int `json:"entity_count"`
}
