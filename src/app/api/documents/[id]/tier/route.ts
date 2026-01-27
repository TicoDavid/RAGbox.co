/**
 * Document Tier API - RAGbox.co
 *
 * PATCH /api/documents/[id]/tier - Change document security tier
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { canPromote, canDemote } from '@/lib/security/tiers'
import { logAuditEvent } from '@/lib/audit/logger'

interface RouteParams {
  params: Promise<{ id: string }>
}

async function getUserId(): Promise<string> {
  const sessionCookie = (await cookies()).get('session')
  return sessionCookie?.value || 'demo_user'
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id: documentId } = await params
    const userId = await getUserId()

    const { targetTier } = await request.json()
    if (typeof targetTier !== 'number' || targetTier < 0 || targetTier > 4) {
      return NextResponse.json(
        { error: 'Invalid target tier. Must be 0-4.' },
        { status: 400 }
      )
    }

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { userId: true, securityTier: true, filename: true },
    })

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (doc.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const currentTier = doc.securityTier
    if (currentTier === targetTier) {
      return NextResponse.json({ error: 'Document is already at this tier' }, { status: 400 })
    }

    const isPromotion = targetTier > currentTier
    const allowed = isPromotion
      ? canPromote(currentTier, targetTier)
      : canDemote(currentTier, targetTier)

    if (!allowed) {
      return NextResponse.json(
        { error: `Cannot ${isPromotion ? 'promote' : 'demote'} from Tier ${currentTier} to Tier ${targetTier}` },
        { status: 400 }
      )
    }

    await prisma.document.update({
      where: { id: documentId },
      data: { securityTier: targetTier },
    })

    // Audit log the tier change
    try {
      await logAuditEvent({
        userId,
        action: 'DOCUMENT_PRIVILEGE_CHANGE',
        resourceId: documentId,
        resourceType: 'document',
        severity: 'WARNING',
        details: {
          filename: doc.filename,
          previousTier: currentTier,
          newTier: targetTier,
          direction: isPromotion ? 'promote' : 'demote',
        },
      })
    } catch {
      // Don't fail the operation
    }

    return NextResponse.json({
      success: true,
      documentId,
      previousTier: currentTier,
      newTier: targetTier,
    })
  } catch (error) {
    console.error('[Tier API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
