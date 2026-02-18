import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/cache/redisClient'

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

// In-memory fallback (per-instance, resets on deploy)
const memStore = new Map<string, { count: number; resetAt: number }>()

async function checkRedis(key: string, limit: number, windowMs: number): Promise<RateLimitResult | null> {
  const redis = getRedis()
  if (!redis) return null

  try {
    const now = Date.now()
    const windowKey = `rl:${key}:${Math.floor(now / windowMs)}`
    const count = await redis.incr(windowKey)
    if (count === 1) {
      await redis.pexpire(windowKey, windowMs)
    }
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: (Math.floor(now / windowMs) + 1) * windowMs,
    }
  } catch {
    return null // fall through to memory
  }
}

function checkMemory(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = memStore.get(key)

  if (!entry || now >= entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }

  entry.count++
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  }
}

// Periodic cleanup of expired memory entries (every 60s)
let lastCleanup = 0
function cleanupMemory() {
  const now = Date.now()
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  for (const [key, entry] of memStore) {
    if (now >= entry.resetAt) memStore.delete(key)
  }
}

/**
 * Rate limit check for API routes.
 * Returns null if allowed, or a 429 NextResponse if blocked.
 *
 * @param request - The incoming request
 * @param limit - Max requests per window (default 60)
 * @param windowMs - Window size in ms (default 60_000 = 1 minute)
 */
export async function rateLimit(
  request: NextRequest,
  limit = 60,
  windowMs = 60_000
): Promise<NextResponse | null> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'

  const path = new URL(request.url).pathname
  const key = `${ip}:${path}`

  cleanupMemory()

  const result = (await checkRedis(key, limit, windowMs)) ?? checkMemory(key, limit, windowMs)

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  return null // allowed
}
