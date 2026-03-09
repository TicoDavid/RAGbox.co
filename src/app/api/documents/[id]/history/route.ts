/**
 * Document History API — RAGbox.co (EPIC-032)
 *
 * GET /api/documents/[id]/history — Return audit trail for a document
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  const { id } = await params

  try {
    // Verify document ownership
    const doc = await prisma.document.findFirst({
      where: { id, userId },
      select: { id: true },
    })

    if (!doc) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    // Fetch audit entries for this document
    const audits = await prisma.auditEntry.findMany({
      where: {
        userId,
        resourceId: id,
        action: { startsWith: 'document.' },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        action: true,
        details: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ success: true, data: { history: audits } })
  } catch (error) {
    logger.error('[Document History] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch history' }, { status: 500 })
  }
}
