import { NextRequest, NextResponse } from 'next/server'

// In-memory sliding window — persists on Cloud Run (single Node.js process)
const hits = new Map<string, { count: number; resetAt: number }>()

const WINDOW_MS = 60_000  // 1 minute
const DEFAULT_LIMIT = 120 // requests per window
const STRICT_LIMIT = 30   // for auth/sensitive endpoints
const STRICT_PATHS = ['/api/auth/send-otp', '/api/waitlist', '/api/beta/', '/api/v1/knowledge/ingest']

function getLimit(pathname: string): number {
  if (STRICT_PATHS.some(p => pathname.startsWith(p))) return STRICT_LIMIT
  return DEFAULT_LIMIT
}

// Periodic cleanup
let lastCleanup = 0
function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  for (const [key, entry] of hits) {
    if (now >= entry.resetAt) hits.delete(key)
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only rate-limit API routes
  if (!pathname.startsWith('/api/')) return NextResponse.next()

  // Skip health check
  if (pathname === '/api/health') return NextResponse.next()

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'

  const limit = getLimit(pathname)
  const key = `${ip}:${pathname}`
  const now = Date.now()

  cleanup()

  const entry = hits.get(key)
  if (!entry || now >= entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return NextResponse.next()
  }

  entry.count++
  if (entry.count > limit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
