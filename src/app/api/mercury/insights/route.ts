/**
 * Mercury Proactive Insights API
 *
 * GET /api/mercury/insights — Returns undismissed insights for the current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

interface InsightRow {
  id: string
  insight_type: string
  summary: string
  entities: string[]
  documents: string[]
  confidence: number
  created_at: Date
}

async function getAuth(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return null
  return { userId: (token.id as string) || token.email || '' }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await getAuth(request)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  try {
    const rows = await prisma.$queryRawUnsafe<InsightRow[]>(
      `SELECT id, insight_type, summary, entities, documents, confidence, created_at
       FROM mercury_proactive_insights
       WHERE user_id = $1 AND dismissed = false
       ORDER BY created_at DESC
       LIMIT 10`,
      auth.userId,
    )

    const insights = rows.map((r) => ({
      id: r.id,
      insightType: r.insight_type,
      summary: r.summary,
      entities: r.entities,
      documents: r.documents,
      confidence: r.confidence,
      createdAt: r.created_at,
    }))

    return NextResponse.json({ success: true, data: insights })
  } catch (error) {
    logger.error('[mercury/insights] Failed to fetch insights', { error })
    return NextResponse.json({ success: false, error: 'Failed to fetch insights' }, { status: 500 })
  }
}
