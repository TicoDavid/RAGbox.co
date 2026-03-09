/**
 * Batch Delete API — RAGbox.co (EPIC-032)
 *
 * POST /api/documents/batch/delete — Soft-delete multiple documents
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { invalidateUserCache } from '@/lib/cache/queryCache'
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

  let body: { ids?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const { ids } = body
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ success: false, error: 'ids array required' }, { status: 400 })
  }
  if (ids.length > 50) {
    return NextResponse.json({ success: false, error: 'Maximum 50 items per batch' }, { status: 400 })
  }

  try {
    // Verify all docs belong to user
    const docs = await prisma.document.findMany({
      where: { id: { in: ids }, userId },
      select: { id: true },
    })
    const validIds = docs.map(d => d.id)
    const invalidIds = ids.filter(id => !validIds.includes(id))

    // Soft-delete valid docs
    const errors: Array<{ id: string; reason: string }> = []
    let successCount = 0

    if (validIds.length > 0) {
      const result = await prisma.document.updateMany({
        where: { id: { in: validIds }, userId },
        data: { deletionStatus: 'SoftDeleted', deletedAt: new Date() },
      })
      successCount = result.count
    }

    // Add invalid IDs to errors
    for (const id of invalidIds) {
      errors.push({ id, reason: 'Not found or not authorized' })
    }

    // Invalidate query cache
    if (successCount > 0) {
      try { await invalidateUserCache(userId) } catch { /* non-fatal */ }
    }

    return NextResponse.json({
      success: true,
      data: { success: successCount, failed: errors.length, errors },
    })
  } catch (error) {
    logger.error('[Batch Delete] Error:', error)
    return NextResponse.json({ success: false, error: 'Batch delete failed' }, { status: 500 })
  }
}
