/**
 * Document Move API — RAGbox.co
 *
 * POST /api/documents/[id]/move — Move document to a folder (or root)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  const { id } = await params

  let body: { folderId?: string | null }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const targetFolderId = body.folderId ?? null

  try {
    // Verify document exists and belongs to user
    const doc = await prisma.document.findFirst({
      where: { id, userId },
      select: { id: true, folderId: true },
    })

    if (!doc) {
      return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 })
    }

    // If moving to a folder, verify folder belongs to same user
    if (targetFolderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: targetFolderId, userId },
        select: { id: true, name: true },
      })

      if (!folder) {
        return NextResponse.json({ success: false, error: 'Target folder not found' }, { status: 404 })
      }
    }

    const updated = await prisma.document.update({
      where: { id },
      data: { folderId: targetFolderId, sortOrder: 0 },
      select: {
        id: true,
        filename: true,
        originalName: true,
        folderId: true,
        sortOrder: true,
      },
    })

    return NextResponse.json({ success: true, data: { document: updated } })
  } catch (error) {
    logger.error('[Document Move] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to move document' }, { status: 500 })
  }
}
