/**
 * ROAM Groups API - RAGbox.co
 *
 * GET /api/roam/groups — List ROAM groups accessible to M.E.R.C.U.R.Y.
 * Used by the dashboard to show which ROAM groups can receive Mercury replies.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { listGroups } from '@/lib/roam/roamClient'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  try {
    const groups = await listGroups()
    return NextResponse.json({
      success: true,
      data: { groups },
    })
  } catch (error) {
    logger.error('[ROAM Groups] Failed to list groups:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch ROAM groups',
    }, { status: 502 })
  }
}
