/**
 * ROAM Event Processor - RAGbox.co
 *
 * POST /api/roam/process-event — Pub/Sub push endpoint
 *
 * Receives ROAM events from Pub/Sub (enqueued by the webhook route).
 * Processes chat messages through the RAG pipeline and replies via ROAM API.
 * Writes every interaction to the Mercury Unified Thread + audit log.
 *
 * Silence Protocol: confidence < 0.65 → structured refusal.
 */

import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { parseSSEText } from '@/lib/mercury/sseParser'
import { sendMessage } from '@/lib/roam/roamClient'
import { formatForRoam, formatSilenceForRoam, formatErrorForRoam } from '@/lib/roam/roamFormat'
import type { Citation } from '@/types/ragbox'

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''
const ROAM_DEFAULT_USER_ID = process.env.ROAM_DEFAULT_USER_ID || process.env.WHATSAPP_DEFAULT_USER_ID || ''
const SILENCE_THRESHOLD = 0.65

// ── Pub/Sub push message shape ─────────────────────────────────────

interface PubSubPushMessage {
  message: {
    data: string       // base64-encoded
    messageId: string
    attributes?: Record<string, string>
  }
  subscription: string
}

// ── ROAM event payload shapes ──────────────────────────────────────
// ROAM sends: chat.message.dm, chat.message.group, message.created, etc.

interface RoamChatEvent {
  type: string
  data: {
    // Direct shape (chat.message.dm / chat.message.group)
    contentType?: string
    text?: string
    sender?: { id: string; name?: string; email?: string }
    chat?: { id: string }
    timestamp?: string
    // Legacy shape (message.created)
    id?: string
    group_id?: string
    sender_id?: string
    sender_name?: string
    thread_id?: string
    created_at?: string
  }
}

interface RoamReactionEvent {
  type: 'reaction.added'
  data: {
    message_id: string
    group_id: string
    user_id: string
    emoji: string
  }
}

type RoamEvent = RoamChatEvent | RoamReactionEvent | { type: string; data: Record<string, unknown> }

/** Event types that contain a chat message to process */
const CHAT_EVENT_TYPES = new Set([
  'message.created',
  'chat.message.dm',
  'chat.message.group',
  'chat.message',
])

// ── Route handler ──────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Parse Pub/Sub push envelope
  let envelope: PubSubPushMessage
  try {
    envelope = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!envelope.message?.data) {
    return NextResponse.json({ error: 'Missing message data' }, { status: 400 })
  }

  // Decode base64 event payload
  let event: RoamEvent
  try {
    const decoded = Buffer.from(envelope.message.data, 'base64').toString('utf-8')
    event = JSON.parse(decoded)
  } catch {
    console.error('[ROAM Processor] Failed to decode event:', envelope.message.messageId)
    // ACK to prevent retry — bad data won't improve on retry
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  console.log(`[ROAM Processor] Event: type=${event.type} msgId=${envelope.message.messageId}`)

  try {
    if (CHAT_EVENT_TYPES.has(event.type)) {
      await processMessage(event as RoamChatEvent)
    } else if (event.type === 'reaction.added') {
      console.log(`[ROAM Processor] Reaction: ${(event as RoamReactionEvent).data.emoji}`)
    } else {
      console.log(`[ROAM Processor] Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    console.error('[ROAM Processor] Processing error:', error)
    // Return 500 so Pub/Sub retries (up to max-delivery-attempts)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}

// ── Message processor ──────────────────────────────────────────────

async function processMessage(event: RoamChatEvent): Promise<void> {
  const d = event.data

  // Normalize across ROAM event shapes:
  //   chat.message.dm/group: data.sender.id, data.chat.id, data.text
  //   message.created:       data.sender_id, data.group_id, data.text
  const text = d.text || ''
  const messageId = d.id || d.timestamp || ''
  const groupId = d.chat?.id || d.group_id || ''
  const senderId = d.sender?.id || d.sender_id || ''
  const senderName = d.sender?.name || d.sender_name
  const threadId = d.thread_id

  if (!text.trim()) {
    console.log('[ROAM Processor] Empty message — skipping')
    return
  }

  // Deduplicate by external message ID
  const existing = await prisma.mercuryThreadMessage.findFirst({
    where: {
      metadata: { path: ['roamMessageId'], equals: messageId },
    },
  })
  if (existing) {
    console.log(`[ROAM Processor] Duplicate message ${messageId} — skipping`)
    return
  }

  const userId = ROAM_DEFAULT_USER_ID
  if (!userId) {
    console.error('[ROAM Processor] No ROAM_DEFAULT_USER_ID configured')
    return
  }

  // 1. Write inbound message to Mercury Unified Thread
  await writeMercuryThreadMessage(userId, 'user', text, undefined, {
    roamMessageId: messageId,
    roamGroupId: groupId,
    roamSenderId: senderId,
    roamSenderName: senderName,
    roamThreadId: threadId,
  })

  // 2. Query Go backend RAG pipeline
  let replyText: string
  let confidence: number | undefined
  let citations: Citation[] = []

  try {
    const ragResponse = await fetch(`${GO_BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_AUTH_SECRET,
        'X-User-ID': userId,
      },
      body: JSON.stringify({
        query: text,
        mode: 'concise',
        privilegeMode: false,
        maxTier: 3,
        history: [],
      }),
    })

    if (!ragResponse.ok) {
      console.error(`[ROAM Processor] RAG backend error: ${ragResponse.status}`)
      replyText = formatErrorForRoam('UPSTREAM_FAILURE')
    } else {
      const responseText = await ragResponse.text()
      const parsed = parseSSEText(responseText)
      confidence = parsed.confidence

      if (parsed.isSilence || (confidence !== undefined && confidence < SILENCE_THRESHOLD)) {
        // Silence Protocol
        replyText = formatSilenceForRoam(parsed.suggestions)
      } else {
        // Build citation objects for formatter
        citations = parsed.citations.map(c => ({
          citationIndex: c.index,
          documentId: c.documentId,
          documentName: c.documentName || 'Document',
          excerpt: c.excerpt,
          relevanceScore: 0,
        }))
        replyText = formatForRoam(parsed.text, citations, { confidence })
      }
    }
  } catch (error) {
    console.error('[ROAM Processor] RAG query failed:', error)
    replyText = formatErrorForRoam('INTERNAL_ERROR')
  }

  if (!replyText) {
    replyText = formatErrorForRoam()
  }

  // 3. Send reply via ROAM API
  try {
    await sendMessage({
      groupId,
      text: replyText,
      threadId: threadId || undefined,
    })
    console.log(`[ROAM Processor] Reply sent to group=${groupId} (confidence: ${confidence ?? 'N/A'})`)
  } catch (error) {
    console.error('[ROAM Processor] ROAM send failed:', error)
    // Still write to thread — reply failed but we have the content
  }

  // 4. Write assistant reply to Mercury Unified Thread
  await writeMercuryThreadMessage(userId, 'assistant', replyText, confidence, {
    roamGroupId: groupId,
    roamThreadId: threadId,
    citationCount: citations.length,
  })

  // 5. Write audit record
  await writeAuditRecord(userId, text, replyText, confidence, groupId)
}

// ── Mercury Unified Thread Writer ──────────────────────────────────

async function writeMercuryThreadMessage(
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  confidence?: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
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

    await prisma.mercuryThreadMessage.create({
      data: {
        threadId: thread.id,
        role,
        channel: 'roam',
        content,
        confidence: confidence ?? null,
        metadata: metadata ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    })

    await prisma.mercuryThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    })
  } catch (error) {
    console.error('[ROAM Processor] Mercury thread write failed:', error)
  }
}

// ── Audit Writer ───────────────────────────────────────────────────

async function writeAuditRecord(
  userId: string,
  query: string,
  response: string,
  confidence: number | undefined,
  roamGroupId: string,
): Promise<void> {
  try {
    await prisma.mercuryAction.create({
      data: {
        userId,
        actionType: 'roam_query',
        status: 'completed',
        metadata: {
          channel: 'roam',
          query: query.slice(0, 500),
          responseLength: response.length,
          confidence,
          roamGroupId,
        } as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    console.error('[ROAM Processor] Audit write failed:', error)
  }
}
