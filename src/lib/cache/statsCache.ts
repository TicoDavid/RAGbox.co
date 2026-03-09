/**
 * Vault Stats Cache — RAGbox.co (EPIC-034)
 *
 * Caches pre-computed vault statistics (doc count, chunk count, entity count).
 * 60-second TTL. FAIL-OPEN: Redis errors = cache miss, never error.
 */

import { getRedis } from './redisClient'
import { logger } from '@/lib/logger'

const STATS_CACHE_TTL = 60 // 60 seconds

interface VaultStats {
  documentCount: number
  chunkCount: number
  entityCount: number
  cachedAt: string
}

function statsCacheKey(userId: string): string {
  return `cache:stats:${userId}`
}

export async function getCachedStats(userId: string): Promise<VaultStats | null> {
  const redis = getRedis()
  if (!redis) return null

  try {
    const cached = await redis.get(statsCacheKey(userId))
    if (cached) return JSON.parse(cached)
    return null
  } catch (err) {
    logger.error('[StatsCache] Read error:', err)
    return null
  }
}

export async function setCachedStats(userId: string, stats: Omit<VaultStats, 'cachedAt'>): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    const value: VaultStats = { ...stats, cachedAt: new Date().toISOString() }
    await redis.setex(statsCacheKey(userId), STATS_CACHE_TTL, JSON.stringify(value))
  } catch (err) {
    logger.error('[StatsCache] Write error:', err)
  }
}

export async function invalidateStatsCache(userId: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.del(statsCacheKey(userId))
  } catch (err) {
    logger.error('[StatsCache] Invalidation error:', err)
  }
}
