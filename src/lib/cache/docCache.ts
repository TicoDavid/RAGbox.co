/**
 * Document Metadata Cache — RAGbox.co (EPIC-034)
 *
 * Caches individual document metadata for fast lookups.
 * 10-minute TTL. FAIL-OPEN: Redis errors = cache miss, never error.
 */

import { getRedis } from './redisClient'
import { logger } from '@/lib/logger'

const DOC_CACHE_TTL = 600 // 10 minutes

interface CachedDocument {
  id: string
  filename: string
  mimeType: string
  indexStatus: string
  chunkCount: number
  sizeBytes: number
  cachedAt: string
}

function docCacheKey(documentId: string): string {
  return `cache:doc:${documentId}`
}

export async function getCachedDocument(documentId: string): Promise<CachedDocument | null> {
  const redis = getRedis()
  if (!redis) return null

  try {
    const cached = await redis.get(docCacheKey(documentId))
    if (cached) return JSON.parse(cached)
    return null
  } catch (err) {
    logger.error('[DocCache] Read error:', err)
    return null
  }
}

export async function setCachedDocument(documentId: string, doc: Omit<CachedDocument, 'cachedAt'>): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    const value: CachedDocument = { ...doc, cachedAt: new Date().toISOString() }
    await redis.setex(docCacheKey(documentId), DOC_CACHE_TTL, JSON.stringify(value))
  } catch (err) {
    logger.error('[DocCache] Write error:', err)
  }
}

export async function invalidateDocCache(documentId: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return

  try {
    await redis.del(docCacheKey(documentId))
  } catch (err) {
    logger.error('[DocCache] Invalidation error:', err)
  }
}
