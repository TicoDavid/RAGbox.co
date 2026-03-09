/**
 * Mercury Session Context Cache — RAGbox.co (EPIC-034)
 *
 * Caches Mercury conversation context for faster follow-up queries.
 * 1-hour TTL. FAIL-OPEN: Redis errors = cache miss, never error.
 */

import { getRedis } from './redisClient'
import { logger } from '@/lib/logger'

const SESSION_CACHE_TTL = 3600 // 1 hour

interface SessionContext {
  threadId: string
  recentMessages: Array<{ role: string; content: string }>
  lastQuery: string
  cachedAt: string
}

function sessionCacheKey(userId: string, threadId: string): string {
  return `cache:session:${userId}:${threadId}`
}

export async function getCachedSession(userId: string, threadId: string): Promise<SessionContext | null> {
  const redis = getRedis()
  if (!redis) return null

  try {
    const cached = await redis.get(sessionCacheKey(userId, threadId))
    if (cached) return JSON.parse(cached)
    return null
  } catch (err) {
    logger.error('[SessionCache] Read error:', err)
    return null
  }
}

export async function setCachedSession(
  userId: string,
  threadId: string,
  context: Omit<SessionContext, 'cachedAt'>
): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    const value: SessionContext = { ...context, cachedAt: new Date().toISOString() }
    await redis.setex(sessionCacheKey(userId, threadId), SESSION_CACHE_TTL, JSON.stringify(value))
  } catch (err) {
    logger.error('[SessionCache] Write error:', err)
  }
}

export async function invalidateSessionCache(userId: string, threadId: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.del(sessionCacheKey(userId, threadId))
  } catch (err) {
    logger.error('[SessionCache] Invalidation error:', err)
  }
}
