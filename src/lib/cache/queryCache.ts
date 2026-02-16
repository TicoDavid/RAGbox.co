import { createHash } from 'crypto'
import { getRedis } from './redisClient'

const CACHE_TTL = 300 // 5 minutes

interface CachedResponse {
  text: string
  confidence: number | undefined
  citations: unknown[]
  cachedAt: string
}

function getCacheKey(query: string, userId: string): string {
  const raw = `${query.toLowerCase().trim()}|${userId}`
  return `ragbox:query:${createHash('sha256').update(raw).digest('hex').substring(0, 16)}`
}

export async function getCachedQuery(
  query: string,
  userId: string,
): Promise<CachedResponse | null> {
  const redis = getRedis()
  if (!redis) return null

  try {
    const key = getCacheKey(query, userId)
    const cached = await redis.get(key)
    if (cached) {
      return JSON.parse(cached)
    }
    return null
  } catch (err) {
    console.error('[Cache] Read error:', err)
    return null
  }
}

export async function setCachedQuery(
  query: string,
  userId: string,
  response: CachedResponse,
): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    const key = getCacheKey(query, userId)
    await redis.setex(key, CACHE_TTL, JSON.stringify(response))
  } catch (err) {
    console.error('[Cache] Write error:', err)
  }
}

export async function invalidateUserCache(userId: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    // Scan for user-related keys and delete
    // Since keys are hashed with userId, a new document upload invalidates all
    const stream = redis.scanStream({ match: 'ragbox:query:*', count: 100 })
    const keysToDelete: string[] = []

    for await (const keys of stream) {
      keysToDelete.push(...(keys as string[]))
    }

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete)
      console.log(`[Cache] Invalidated ${keysToDelete.length} cached queries`)
    }
  } catch (err) {
    console.error('[Cache] Invalidation error:', err)
  }
}
