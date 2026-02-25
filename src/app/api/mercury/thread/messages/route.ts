/**
 * Mercury Thread Messages API - RAGbox.co
 *
 * GET  /api/mercury/thread/messages?threadId=X&channel=Y&after=Z&limit=N — Paginated messages with optional channel filter
 * POST /api/mercury/thread/messages — Add a message to the thread
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { writeAuditEntry } from '@/lib/audit/auditWriter'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const userId = (token.id as string) || token.email || ''
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const threadId = searchParams.get('threadId')
    const channel = searchParams.get('channel') as 'dashboard' | 'whatsapp' | 'voice' | 'email' | 'sms' | 'roam' | null
    const after = searchParams.get('after') // ISO timestamp for polling
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const cursor = searchParams.get('cursor') // message id for cursor-based pagination

    // If no threadId, get the user's most recent thread
    let resolvedThreadId = threadId
    if (!resolvedThreadId) {
      const thread = await prisma.mercuryThread.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      })
      if (!thread) {
        return NextResponse.json({ success: true, data: { messages: [], hasMore: false } })
      }
      resolvedThreadId = thread.id
    }

    // Verify thread belongs to user
    const thread = await prisma.mercuryThread.findFirst({
      where: { id: resolvedThreadId, userId },
      select: { id: true },
    })
    if (!thread) {
      return NextResponse.json({ success: false, error: 'Thread not found' }, { status: 404 })
    }

    // Build where clause
    const where: Record<string, unknown> = { threadId: resolvedThreadId }
    if (channel) {
      where.channel = channel
    }
    if (after) {
      where.createdAt = { gt: new Date(after) }
    }
    if (cursor) {
      const cursorMsg = await prisma.mercuryThreadMessage.findUnique({
        where: { id: cursor },
        select: { createdAt: true },
      })
      if (cursorMsg) {
        where.createdAt = { ...(where.createdAt as object || {}), lt: cursorMsg.createdAt }
      }
    }

    const messages = await prisma.mercuryThreadMessage.findMany({
      where,
      orderBy: { createdAt: after ? 'asc' : 'desc' },
      take: limit + 1,
      select: {
        id: true,
        role: true,
        channel: true,
        content: true,
        confidence: true,
        citations: true,
        metadata: true,
        createdAt: true,
      },
    })

    const hasMore = messages.length > limit
    const result = hasMore ? messages.slice(0, limit) : messages

    // If not using 'after' (polling), reverse to chronological order
    if (!after) {
      result.reverse()
    }

    return NextResponse.json({
      success: true,
      data: {
        messages: result,
        hasMore,
        nextCursor: hasMore ? result[result.length - 1]?.id : undefined,
      },
    })
  } catch (error) {
    logger.error('[Mercury Messages GET] Error:', error)
    // Return 200 with empty messages — prevents polling 500s every 5 seconds
    return NextResponse.json({ success: true, data: { messages: [], hasMore: false } })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const userId = (token.id as string) || token.email || ''
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
    }

    const body = await request.json()
    const { threadId, role, channel, content, confidence, citations, metadata, channelMessageId, direction } = body

    if (!content || !role || !channel) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: content, role, channel' },
        { status: 400 }
      )
    }

    // Validate enums
    if (!['user', 'assistant'].includes(role)) {
      return NextResponse.json({ success: false, error: 'Invalid role' }, { status: 400 })
    }
    if (!['dashboard', 'whatsapp', 'voice', 'roam', 'email', 'sms'].includes(channel)) {
      return NextResponse.json({ success: false, error: 'Invalid channel' }, { status: 400 })
    }

    // Resolve or create thread
    let resolvedThreadId = threadId
    if (!resolvedThreadId) {
      let thread = await prisma.mercuryThread.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      })
      if (!thread) {
        thread = await prisma.mercuryThread.create({
          data: { userId, title: 'Mercury Thread' },
          select: { id: true },
        })
      }
      resolvedThreadId = thread.id
    }

    // Verify thread belongs to user
    const thread = await prisma.mercuryThread.findFirst({
      where: { id: resolvedThreadId, userId },
      select: { id: true },
    })
    if (!thread) {
      return NextResponse.json({ success: false, error: 'Thread not found' }, { status: 404 })
    }

    // Create message
    const message = await prisma.mercuryThreadMessage.create({
      data: {
        threadId: resolvedThreadId,
        role,
        channel,
        content,
        confidence: confidence ?? null,
        citations: citations ?? null,
        metadata: metadata ?? null,
        channelMessageId: channelMessageId ?? null,
        direction: direction ?? (role === 'user' ? 'inbound' : 'outbound'),
      },
      select: {
        id: true,
        role: true,
        channel: true,
        content: true,
        confidence: true,
        citations: true,
        metadata: true,
        createdAt: true,
      },
    })

    // Touch thread's updatedAt
    await prisma.mercuryThread.update({
      where: { id: resolvedThreadId },
      data: { updatedAt: new Date() },
    })

    // Audit log (best-effort) — log user queries and assistant responses
    writeAuditEntry(userId, role === 'user' ? 'mercury.query' : 'mercury.response', message.id, {
      channel,
      contentPreview: content.slice(0, 100),
      confidence: confidence ?? undefined,
    }).catch(() => {})

    return NextResponse.json({ success: true, data: message }, { status: 201 })
  } catch (error) {
    logger.error('[Mercury Messages POST] Error:', error)
    // Return 200 — message persistence is best-effort, shouldn't crash the UI
    return NextResponse.json({ success: false, error: 'Failed to save message' })
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const userId = (token.id as string) || token.email || ''
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
    }

    // Accept explicit threadId from request body, fall back to most recent
    let targetThreadId: string | null = null
    try {
      const body = await request.json()
      targetThreadId = body.threadId || null
    } catch {
      // No body — fall back to most recent thread
    }

    if (targetThreadId) {
      // Verify ownership
      const owned = await prisma.mercuryThread.findFirst({
        where: { id: targetThreadId, userId },
        select: { id: true },
      })
      if (!owned) targetThreadId = null
    }

    if (!targetThreadId) {
      const thread = await prisma.mercuryThread.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      })
      targetThreadId = thread?.id || null
    }

    if (!targetThreadId) {
      return NextResponse.json({ success: true, data: { deleted: 0 } })
    }

    // Delete all messages in the thread
    const result = await prisma.mercuryThreadMessage.deleteMany({
      where: { threadId: targetThreadId },
    })

    // Audit log
    writeAuditEntry(userId, 'mercury.clear', targetThreadId, {
      deletedCount: result.count,
    }).catch(() => {})

    return NextResponse.json({ success: true, data: { deleted: result.count } })
  } catch (error) {
    logger.error('[Mercury Messages DELETE] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to clear messages' }, { status: 500 })
  }
}
