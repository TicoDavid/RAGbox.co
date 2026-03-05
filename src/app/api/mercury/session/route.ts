/**
 * Mercury Session Summary API (E24-002)
 *
 * POST — Save a session summary (called on disconnect/beforeunload)
 * GET  — Load last N session summaries for cross-session memory
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

const MAX_SUMMARIES = 3

// POST: Save a session summary
export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { summary, topics, decisions, actionItems, messageCount, persona, threadId } = body

    if (!summary || typeof summary !== 'string' || summary.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Summary is required' }, { status: 400 })
    }

    const record = await prisma.mercurySessionSummary.create({
      data: {
        userId,
        threadId: threadId ?? null,
        summary: summary.trim(),
        topics: Array.isArray(topics) ? topics : [],
        decisions: Array.isArray(decisions) ? decisions : [],
        actionItems: Array.isArray(actionItems) ? actionItems : [],
        messageCount: typeof messageCount === 'number' ? messageCount : 0,
        persona: persona ?? null,
      },
    })

    logger.info('[Session] Summary saved', {
      userId,
      summaryId: record.id,
      messageCount: record.messageCount,
      topicCount: record.topics.length,
    })

    return NextResponse.json({ success: true, data: { id: record.id } })
  } catch (err) {
    logger.error('[Session] Failed to save summary:', err)
    return NextResponse.json({ success: false, error: 'Failed to save session summary' }, { status: 500 })
  }
}

// GET: Load last N session summaries for context injection
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') ?? String(MAX_SUMMARIES), 10)
    const effectiveLimit = Math.min(Math.max(limit, 1), 10)

    const summaries = await prisma.mercurySessionSummary.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: effectiveLimit,
      select: {
        id: true,
        summary: true,
        topics: true,
        decisions: true,
        actionItems: true,
        messageCount: true,
        persona: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ success: true, data: summaries })
  } catch (err) {
    logger.error('[Session] Failed to load summaries:', err)
    return NextResponse.json({ success: true, data: [] })
  }
}
