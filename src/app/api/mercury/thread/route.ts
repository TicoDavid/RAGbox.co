/**
 * Mercury Thread API - RAGbox.co
 *
 * GET /api/mercury/thread — Get or create the user's active thread
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

    // Get most recent thread or create one
    let thread = await prisma.mercuryThread.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!thread) {
      thread = await prisma.mercuryThread.create({
        data: { userId, title: 'Mercury Thread' },
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    }

    return NextResponse.json({ success: true, data: thread })
  } catch (error) {
    console.error('[Mercury Thread] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load thread' },
      { status: 500 }
    )
  }
}
