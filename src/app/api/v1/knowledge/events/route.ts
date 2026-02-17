/**
 * Knowledge Events List — GET /api/v1/knowledge/events
 *
 * Lists knowledge events for the authenticated tenant.
 * Supports filtering by status, source_id, and pagination.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey, hasScope } from '@/lib/api/apiKeyMiddleware'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateApiKey(request)
  if (!auth) {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing API key' },
      { status: 401 }
    )
  }

  if (!hasScope(auth, 'read')) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. "read" scope required.' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const sourceId = searchParams.get('source_id')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '25', 10) || 25, 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10) || 0

  // Build filter
  const where: Record<string, unknown> = {
    tenantId: auth.tenantId,
    userId: auth.userId,
  }
  if (status) where.status = status
  if (sourceId) where.sourceId = sourceId

  const [events, total] = await Promise.all([
    prisma.knowledgeEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        eventId: true,
        sourceId: true,
        sourceName: true,
        title: true,
        contentType: true,
        status: true,
        documentId: true,
        privilegeLevel: true,
        tags: true,
        errorDetails: true,
        processedAt: true,
        createdAt: true,
      },
    }),
    prisma.knowledgeEvent.count({ where }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      events,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    },
  })
}
