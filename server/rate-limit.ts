/**
 * Rate Limiting - RAGbox.co
 *
 * Simple in-memory rate limiter for API endpoints.
 * In production, use Redis for distributed rate limiting.
 */

// ============================================================================
// TYPES
// ============================================================================

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface RateLimitConfig {
  /** Max requests per window */
  limit: number
  /** Window size in milliseconds */
  windowMs: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterMs?: number
}

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
  private entries = new Map<string, RateLimitEntry>()
  private config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = config

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60_000)
  }

  check(key: string): RateLimitResult {
    const now = Date.now()
    let entry = this.entries.get(key)

    // Create new entry or reset if window expired
    if (!entry || now >= entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + this.config.windowMs,
      }
      this.entries.set(key, entry)
    }

    // Check if limit exceeded
    if (entry.count >= this.config.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        retryAfterMs: entry.resetAt - now,
      }
    }

    // Increment and allow
    entry.count++
    return {
      allowed: true,
      remaining: this.config.limit - entry.count,
      resetAt: entry.resetAt,
    }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.entries) {
      if (now >= entry.resetAt) {
        this.entries.delete(key)
      }
    }
  }
}

// ============================================================================
// ENDPOINT-SPECIFIC LIMITERS
// ============================================================================

// Agent session: 10 sessions per minute per user
export const agentSessionLimiter = new RateLimiter({
  limit: 10,
  windowMs: 60_000,
})

// Chat API: 30 requests per minute per user
export const chatApiLimiter = new RateLimiter({
  limit: 30,
  windowMs: 60_000,
})

// Upload: 10 uploads per minute per user
export const uploadLimiter = new RateLimiter({
  limit: 10,
  windowMs: 60_000,
})

// Export: 5 exports per hour per user
export const exportLimiter = new RateLimiter({
  limit: 5,
  windowMs: 60 * 60_000,
})

// ============================================================================
// HELPER FUNCTION
// ============================================================================

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.remaining + (result.allowed ? 0 : 1)),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    ...(result.retryAfterMs ? { 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) } : {}),
  }
}
