/**
 * Mercury Thread List API - RAGbox.co
 *
 * GET /api/mercury/thread/list?limit=20 — List recent threads for current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

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

    const limitParam = request.nextUrl.searchParams.get('limit')
    const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 50)

    const threads = await prisma.mercuryThread.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    })

    return NextResponse.json({ success: true, data: { threads } })
  } catch (error) {
    console.error('[Mercury Thread List] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to list threads' }, { status: 500 })
  }
}
