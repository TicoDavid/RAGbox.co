/**
 * Document Promotion API - RAGbox.co
 *
 * POST /api/documents/promote
 * Manually promote a document from Tier 0 to Tier 1
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { promoteToTier1 } from '@/lib/security/autoPromotion'

async function getUserId(): Promise<string | null> {
  const sessionCookie = (await cookies()).get('session')
  return sessionCookie?.value || 'demo_user'
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { documentId } = await request.json()
    if (!documentId) {
      return NextResponse.json({ error: 'documentId is required' }, { status: 400 })
    }

    const promoted = await promoteToTier1(documentId)

    return NextResponse.json({
      success: promoted,
      message: promoted
        ? 'Document promoted to Tier 1 (Standard)'
        : 'Document could not be promoted (already promoted or not indexed)',
    })
  } catch (error) {
    console.error('[Promote API] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
