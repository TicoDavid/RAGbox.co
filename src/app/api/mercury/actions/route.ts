/**
 * Mercury Action History — GET /api/mercury/actions
 *
 * Returns recent MercuryAction records for the authenticated user.
 * Supports ?limit=N (default 20, max 100) and ?type= filter.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const userId = (token.id as string) || token.email || ''
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limitParam = parseInt(searchParams.get('limit') || '20', 10)
    const limit = Math.min(Math.max(1, limitParam), 100)
    const actionType = searchParams.get('type') || undefined

    const where: { userId: string; actionType?: string } = { userId }
    if (actionType) {
      where.actionType = actionType
    }

    const actions = await prisma.mercuryAction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        actionType: true,
        recipient: true,
        subject: true,
        status: true,
        metadata: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: { actions, count: actions.length },
    })
  } catch (error) {
    logger.error('[Mercury Actions] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch action history' },
      { status: 500 }
    )
  }
}
