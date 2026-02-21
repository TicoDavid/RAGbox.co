/**
 * Usage API — proxies to Go backend /api/v1/usage.
 *
 * GET /api/usage → returns current usage for authenticated tenant.
 * Falls back to stub data when backend is unavailable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080'
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/usage`, {
      headers: {
        'X-Internal-Auth': INTERNAL_AUTH_SECRET,
        'X-User-ID': session.user.id,
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      throw new Error(`Backend returned ${res.status}`)
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    // Fallback: return stub usage when backend is unavailable
    console.warn('[Usage] Backend unavailable, returning stub:', error)
    return NextResponse.json({
      tier: 'free',
      period: {
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().split('T')[0],
      },
      usage: {
        aegis_queries: { used: 0, limit: 25, percent: 0 },
        documents_stored: { used: 0, limit: 5, percent: 0 },
        voice_minutes: { used: 0, limit: 0, percent: 0 },
        api_calls: { used: 0, limit: 0, percent: 0 },
      },
      overage: {
        enabled: false,
        rates: { aegis_query: 0.02, document: 0.50, voice_minute: 0.15 },
      },
    })
  }
}
