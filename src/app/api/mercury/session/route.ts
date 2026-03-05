/**
 * Mercury Session Summary API (E24-002)
 *
 * POST — Save a session summary (called on disconnect/beforeunload)
 * GET  — Load last N session summaries for cross-session memory
 *
 * Note: Uses Prisma.$executeRawUnsafe for new fields (decisions, actionItems,
 * messageCount) until Prisma client is regenerated with updated schema.
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

    // Use raw insert to handle fields not yet in the generated Prisma client
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const topicsArr = Array.isArray(topics) ? topics : []
    const decisionsArr = Array.isArray(decisions) ? decisions : []
    const actionItemsArr = Array.isArray(actionItems) ? actionItems : []
    const msgCount = typeof messageCount === 'number' ? messageCount : 0

    await prisma.$executeRawUnsafe(
      `INSERT INTO mercury_session_summaries (id, user_id, thread_id, summary, topics, decisions, action_items, message_count, persona, created_at)
       VALUES ($1, $2, $3, $4, $5::text[], $6::text[], $7::text[], $8, $9, NOW())`,
      id, userId, threadId ?? null, summary.trim(),
      topicsArr, decisionsArr, actionItemsArr,
      msgCount, persona ?? null
    )

    logger.info('[Session] Summary saved', {
      userId,
      summaryId: id,
      messageCount: msgCount,
      topicCount: topicsArr.length,
    })

    return NextResponse.json({ success: true, data: { id } })
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

    // Use raw query to access all fields including those not yet in generated client
    const summaries = await prisma.$queryRawUnsafe<Array<{
      id: string
      summary: string
      topics: string[]
      decisions: string[]
      action_items: string[]
      message_count: number
      persona: string | null
      created_at: Date
    }>>(
      `SELECT id, summary, topics, decisions, action_items, message_count, persona, created_at
       FROM mercury_session_summaries
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      userId, effectiveLimit
    )

    const mapped = summaries.map(s => ({
      id: s.id,
      summary: s.summary,
      topics: s.topics,
      decisions: s.decisions,
      actionItems: s.action_items,
      messageCount: s.message_count,
      persona: s.persona,
      createdAt: s.created_at,
    }))

    return NextResponse.json({ success: true, data: mapped })
  } catch (err) {
    logger.error('[Session] Failed to load summaries:', err)
    return NextResponse.json({ success: true, data: [] })
  }
}
