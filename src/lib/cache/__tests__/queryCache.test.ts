/**
 * Sarah — EPIC-034 T7: Redis Cache Tests (TypeScript)
 */

import { createHash } from 'crypto'

// ── Mock Redis ────────────────────────────────────────────────

const mockRedisInstance = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  scanStream: jest.fn(),
  on: jest.fn(),
}

let mockRedisURL: string | undefined = 'redis://10.215.185.51:6379'
let mockRedisRef: typeof mockRedisInstance | null = mockRedisInstance

jest.mock('@/lib/cache/redisClient', () => ({
  getRedis: () => {
    if (!mockRedisURL) return null
    return mockRedisRef
  },
}))

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

import { getCachedQuery, setCachedQuery, invalidateUserCache } from '../queryCache'

// ── Helpers ────────────────────────────────────────────────────

function computeCacheKey(query: string, userId: string): string {
  const raw = `${query.toLowerCase().trim()}|${userId}`
  return `ragbox:query:${createHash('sha256').update(raw).digest('hex').substring(0, 16)}`
}

const MOCK_RESPONSE = {
  text: 'The payment terms require net-30.',
  confidence: 0.92,
  citations: [{ chunkId: 'c1', excerpt: 'net-30 days' }],
  cachedAt: new Date().toISOString(),
}

// ── Tests ──────────────────────────────────────────────────────

describe('queryCache', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRedisURL = 'redis://10.215.185.51:6379'
    mockRedisRef = mockRedisInstance
  })

  describe('getCachedQuery', () => {
    it('returns null on cache miss', async () => {
      mockRedisInstance.get.mockResolvedValue(null)

      const result = await getCachedQuery('What are the payment terms?', 'user-001')
      expect(result).toBeNull()
      expect(mockRedisInstance.get).toHaveBeenCalledWith(
        computeCacheKey('What are the payment terms?', 'user-001'),
      )
    })

    it('returns cached response on hit', async () => {
      mockRedisInstance.get.mockResolvedValue(JSON.stringify(MOCK_RESPONSE))

      const result = await getCachedQuery('What are the payment terms?', 'user-001')
      expect(result).toEqual(MOCK_RESPONSE)
    })

    it('returns null when REDIS_URL not set (graceful disable)', async () => {
      mockRedisURL = undefined

      const result = await getCachedQuery('test query', 'user-001')
      expect(result).toBeNull()
      expect(mockRedisInstance.get).not.toHaveBeenCalled()
    })

    it('returns null on Redis connection error (fail-open)', async () => {
      mockRedisInstance.get.mockRejectedValue(
        new Error('ECONNREFUSED 10.215.185.51:6379'),
      )

      const result = await getCachedQuery('test query', 'user-001')
      expect(result).toBeNull()
    })
  })

  describe('setCachedQuery', () => {
    it('stores response with TTL', async () => {
      mockRedisInstance.setex.mockResolvedValue('OK')

      await setCachedQuery('What are the payment terms?', 'user-001', MOCK_RESPONSE)

      const expectedKey = computeCacheKey('What are the payment terms?', 'user-001')
      expect(mockRedisInstance.setex).toHaveBeenCalledWith(
        expectedKey,
        900, // 15-minute TTL from QUERY_CACHE_TTL default
        JSON.stringify(MOCK_RESPONSE),
      )
    })

    it('fails silently on Redis error (fail-open)', async () => {
      mockRedisInstance.setex.mockRejectedValue(
        new Error('ECONNREFUSED'),
      )

      // Should not throw
      await expect(
        setCachedQuery('test', 'user-001', MOCK_RESPONSE),
      ).resolves.toBeUndefined()
    })

    it('does nothing when REDIS_URL not set', async () => {
      mockRedisURL = undefined

      await setCachedQuery('test', 'user-001', MOCK_RESPONSE)
      expect(mockRedisInstance.setex).not.toHaveBeenCalled()
    })
  })

  describe('invalidateUserCache', () => {
    it('removes all user cached queries', async () => {
      // Mock scanStream to return async iterable
      const mockStream = {
        [Symbol.asyncIterator]: async function* () {
          yield ['ragbox:query:abc123', 'ragbox:query:def456']
        },
      }
      mockRedisInstance.scanStream.mockReturnValue(mockStream)
      mockRedisInstance.del.mockResolvedValue(2)

      await invalidateUserCache('user-001')

      expect(mockRedisInstance.scanStream).toHaveBeenCalledWith({
        match: 'ragbox:query:*',
        count: 100,
      })
      expect(mockRedisInstance.del).toHaveBeenCalledWith(
        'ragbox:query:abc123',
        'ragbox:query:def456',
      )
    })
  })

  describe('cache key format', () => {
    it('cache key is SHA-256 of query+userId', () => {
      const key = computeCacheKey('What are the payment terms?', 'user-001')
      expect(key).toMatch(/^ragbox:query:[a-f0-9]{16}$/)
    })

    it('same query+user produces same key', () => {
      const key1 = computeCacheKey('What are the payment terms?', 'user-001')
      const key2 = computeCacheKey('What are the payment terms?', 'user-001')
      expect(key1).toBe(key2)
    })

    it('different query produces different key', () => {
      const key1 = computeCacheKey('What are the payment terms?', 'user-001')
      const key2 = computeCacheKey('Who are the parties?', 'user-001')
      expect(key1).not.toBe(key2)
    })

    it('key is case-insensitive for query', () => {
      const key1 = computeCacheKey('What are the Payment Terms?', 'user-001')
      const key2 = computeCacheKey('what are the payment terms?', 'user-001')
      expect(key1).toBe(key2)
    })
  })
})
