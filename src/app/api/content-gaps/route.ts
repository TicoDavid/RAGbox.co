/**
 * Content Gaps API - RAGbox.co
 *
 * GET /api/content-gaps?status=open&limit=50 — List content gaps for the authenticated user
 *
 * Previously proxied to Go backend; now queries Prisma directly so the endpoint
 * works even when the Go backend is unavailable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userId = (token.id as string) || token.email || ''
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unable to determine user identity' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as 'open' | 'addressed' | 'dismissed' | null
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)

    const where: Record<string, unknown> = { userId }
    if (status) {
      where.status = status
    }

    const gaps = await prisma.contentGap.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        queryText: true,
        confidenceScore: true,
        suggestedTopics: true,
        status: true,
        addressedAt: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: gaps,
    })
  } catch (error) {
    logger.error('[Content Gaps GET] Error:', error)

    // Return empty array instead of crashing — the frontend toolExecutor
    // expects a valid JSON response with a data array
    return NextResponse.json({
      success: true,
      data: [],
    })
  }
}
