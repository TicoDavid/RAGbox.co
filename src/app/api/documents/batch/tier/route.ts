/**
 * Batch Tier API — RAGbox.co (EPIC-032)
 *
 * POST /api/documents/batch/tier — Update security tier for multiple documents
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

const batchTierSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(50),
  tier: z.number().int().min(0).max(4),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = batchTierSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 })
  }
  const { ids, tier } = parsed.data

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
