import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// In-memory sliding window — persists per Cloud Run instance, resets on deploy
const hits = new Map<string, { count: number; resetAt: number }>()

const WINDOW_MS = 60_000 // 1 minute

// Route-specific rate limit configuration
// keyBy: 'user' = NextAuth session ID (fallback to IP), 'ip' = always IP
interface RateLimitRule {
  limit: number
  keyBy: 'user' | 'ip'
}

const ROUTE_LIMITS: Record<string, RateLimitRule> = {
  '/api/chat':                { limit: 30,  keyBy: 'user' },
  '/api/auth/send-otp':       { limit: 5,   keyBy: 'ip' },
  '/api/documents/extract':   { limit: 10,  keyBy: 'user' },
  '/api/waitlist':            { limit: 5,   keyBy: 'ip' },
  '/api/beta/validate':       { limit: 10,  keyBy: 'ip' },
  '/api/v1/knowledge/ingest': { limit: 10,  keyBy: 'user' },
}

const DEFAULT_LIMIT = 120
const SKIP_PATHS = ['/api/health', '/api/auth/callback', '/api/auth/session', '/api/auth/providers', '/api/auth/csrf']

function findRule(pathname: string): RateLimitRule | null {
  if (ROUTE_LIMITS[pathname]) return ROUTE_LIMITS[pathname]
  for (const [route, rule] of Object.entries(ROUTE_LIMITS)) {
    if (pathname.startsWith(route)) return rule
  }
  return null
}

// Periodic cleanup — purge expired entries every 60s
let lastCleanup = 0
function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  for (const [key, entry] of hits) {
    if (now >= entry.resetAt) hits.delete(key)
  }
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

function addRateLimitHeaders(response: NextResponse, limit: number, remaining: number, resetAt: number): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(limit))
  response.headers.set('X-RateLimit-Remaining', String(remaining))
  response.headers.set('X-RateLimit-Reset', String(resetAt))
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only rate-limit API routes
  if (!pathname.startsWith('/api/')) return NextResponse.next()

  // Skip health checks and NextAuth internal routes
  if (SKIP_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()

  const rule = findRule(pathname)
  const limit = rule?.limit ?? DEFAULT_LIMIT

  // Determine rate limit key
  const ip = getClientIp(request)
  let key: string

  if (rule?.keyBy === 'user') {
    try {
      const token = await getToken({ req: request })
      const userId = token?.sub || (typeof token?.email === 'string' ? token.email : null)
      key = userId ? `user:${userId}:${pathname}` : `ip:${ip}:${pathname}`
    } catch {
      key = `ip:${ip}:${pathname}`
    }
  } else {
    key = `ip:${ip}:${pathname}`
  }

  const now = Date.now()
  cleanup()

  const entry = hits.get(key)
  const resetEpoch = Math.ceil((now + WINDOW_MS) / 1000)

  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return addRateLimitHeaders(NextResponse.next(), limit, limit - 1, resetEpoch)
  }

  entry.count++
  const remaining = Math.max(0, limit - entry.count)
  const entryResetEpoch = Math.ceil(entry.resetAt / 1000)

  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return addRateLimitHeaders(
      NextResponse.json(
        { error: 'Too many requests', retryAfter },
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfter) },
        }
      ),
      limit,
      0,
      entryResetEpoch
    )
  }

  return addRateLimitHeaders(NextResponse.next(), limit, remaining, entryResetEpoch)
}

export const config = {
  matcher: '/api/:path*',
}
