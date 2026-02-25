/**
 * Usage API — proxies to Go backend /api/v1/usage.
 *
 * GET /api/usage → returns current usage for authenticated tenant.
 * STORY-S06: Returns 503 when backend is unreachable (no more zero-stub fallback).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logger } from '@/lib/logger'

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
    // STORY-S06: Return 503 when backend unreachable — clients must distinguish
    // real zeros from service unavailability.
    logger.error('[Usage] Backend unavailable:', error)
    return NextResponse.json(
      { error: 'Usage service unavailable' },
      { status: 503 }
    )
  }
}
