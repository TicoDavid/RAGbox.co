/**
 * Document Preview API — RAGbox.co (EPIC-032)
 *
 * GET /api/documents/[id]/preview — Return content preview + signed URL
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { GO_BACKEND_URL, backendHeaders } from '@/lib/backend-proxy'
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
    const document = await prisma.document.findFirst({
      where: { id, userId, deletionStatus: 'Active' },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
          take: 10,
          select: { content: true },
        },
      },
    })

    if (!document) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
    }

    // Build content preview from chunks
    const contentPreview = document.chunks.length > 0
      ? document.chunks.map(c => c.content).join('\n').slice(0, 5000)
      : null

    // Fetch signed URL from Go backend download endpoint (reuse existing logic)
    let signedUrl: string | null = null
    if (document.storageUri) {
      try {
        const res = await fetch(`${GO_BACKEND_URL}/api/documents/${id}/download`, {
          headers: backendHeaders(userId),
        })
        if (res.ok) {
          const data = await res.json()
          signedUrl = data.url || null
        }
      } catch (err) {
        logger.error('[Preview] Failed to get signed URL:', err)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        content: contentPreview,
        signedUrl,
        mimeType: document.mimeType,
        filename: document.filename,
        chunkCount: document.chunkCount,
      },
    })
  } catch (error) {
    logger.error('[Preview] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate preview' }, { status: 500 })
  }
}
