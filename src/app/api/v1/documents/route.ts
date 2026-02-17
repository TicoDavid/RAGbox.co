/**
 * RAGbox Public API — Documents
 *
 * GET  /api/v1/documents — List documents (paginated)
 * POST /api/v1/documents — Upload a document
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey, hasScope } from '@/lib/api/apiKeyMiddleware'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateApiKey(request)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
  }

  if (!hasScope(auth, 'read')) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const status = searchParams.get('status') || undefined

  const where: Record<string, unknown> = {
    userId: auth.userId,
    deletionStatus: 'Active',
  }
  if (status) where.indexStatus = status

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        fileType: true,
        sizeBytes: true,
        indexStatus: true,
        privilegeLevel: true,
        isRestricted: true,
        chunkCount: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.document.count({ where }),
  ])

  return NextResponse.json({ success: true, data: { documents, total, limit, offset } })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateApiKey(request)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
  }

  if (!hasScope(auth, 'write')) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions. "write" scope required.' }, { status: 403 })
  }

  // For now, return a placeholder — file upload via API requires multipart handling
  return NextResponse.json(
    { success: false, error: 'Document upload via API is not yet supported. Use the dashboard.' },
    { status: 501 }
  )
}
