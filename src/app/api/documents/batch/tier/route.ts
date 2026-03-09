/**
 * Batch Tier API — RAGbox.co (EPIC-032)
 *
 * POST /api/documents/batch/tier — Update security tier for multiple documents
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  let body: { ids?: string[]; tier?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { ids, tier } = body
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ success: false, error: 'ids array required' }, { status: 400 })
  }
  if (ids.length > 50) {
    return NextResponse.json({ success: false, error: 'Maximum 50 items per batch' }, { status: 400 })
  }
  if (typeof tier !== 'number' || tier < 0 || tier > 4) {
    return NextResponse.json({ success: false, error: 'Invalid tier (0-4)' }, { status: 400 })
  }

  try {
    // Verify docs belong to user
    const docs = await prisma.document.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true },
    })
    const validIds = docs.map(d => d.id)

    // Batch update
    const result = await prisma.document.updateMany({
      where: { id: { in: validIds }, userId },
      data: { securityTier: tier },
    })

    return NextResponse.json({
      success: true,
      data: {
        success: result.count,
        failed: ids.length - result.count,
        errors: ids
          .filter(id => !validIds.includes(id))
          .map(id => ({ id, reason: 'Not found or not authorized' })),
      },
    })
  } catch (error) {
    logger.error('[Batch Tier] Error:', error)
    return NextResponse.json({ success: false, error: 'Batch tier update failed' }, { status: 500 })
  }
}
