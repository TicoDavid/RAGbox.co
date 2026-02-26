/**
 * ROAM Event Processor - RAGbox.co
 *
 * POST /api/roam/process-event — Pub/Sub push endpoint
 *
 * Receives ROAM events from Pub/Sub (enqueued by the webhook route).
 * Processes chat messages through the RAG pipeline and replies via ROAM API.
 * Writes every interaction to the Mercury Unified Thread + audit log.
 *
 * Per-tenant wiring: resolves tenant from groupId via RoamIntegration,
 * decrypts tenant API key, and routes through tenant's credentials.
 *
 * Silence Protocol: confidence < 0.65 → structured refusal.
 *
 * STORY-102 — EPIC-010
 */

import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { parseSSEText } from '@/lib/mercury/sseParser'
import { sendMessage, sendTypingIndicator, chatPost, chatTypingV0, getTranscriptInfo, RoamApiError } from '@/lib/roam/roamClient'
import { formatForRoam, formatSilenceForRoam, formatErrorForRoam, formatMeetingSummary } from '@/lib/roam/roamFormat'
import { buildBlockKitResponse } from '@/lib/roam/roamBlockKit'
import { writeDeadLetter } from '@/lib/roam/deadLetterWriter'
import { logger } from '@/lib/logger'
import { decryptKey } from '@/lib/utils/kms'
import { randomUUID } from 'crypto'
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
    timestamp?: string | number
    threadTimestamp?: number
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

interface RoamTranscriptEvent {
  type: 'transcript.saved'
  data: {
    transcript_id: string
    group_id?: string
    chat?: { id: string }
    title?: string
  }
}

type RoamEvent = RoamChatEvent | RoamReactionEvent | RoamTranscriptEvent | { type: string; data: Record<string, unknown> }

/** Event types that contain a chat message to process */
const CHAT_EVENT_TYPES = new Set([
  'message.created',
  'chat.message.dm',
  'chat.message.group',
  'chat.message',
])

// ── Tenant resolution result ─────────────────────────────────────

interface TenantContext {
  tenantId: string
  userId: string
  apiKey: string | null
  personalityPrompt: string | null
}

// ── Key revocation handler ──────────────────────────────────────────

async function handleKeyRevoked(tenantId: string, userId: string): Promise<void> {
  try {
    await prisma.roamIntegration.update({
      where: { tenantId },
      data: {
        status: 'error',
        errorReason: 'API key revoked or invalid (401)',
      },
    })

    await prisma.mercuryAction.create({
      data: {
        userId,
        actionType: 'roam_key_revoked',
        status: 'completed',
        metadata: {
          channel: 'roam',
          tenantId,
          reason: 'Received 401 from ROAM API — key may be revoked',
        } as Prisma.InputJsonValue,
      },
    })

    logger.warn(`[ROAM Processor] Key revoked for tenant ${tenantId} — integration set to error`)
  } catch (error) {
    logger.error('[ROAM Processor] handleKeyRevoked failed:', error)
  }
}

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
    logger.error('[ROAM Processor] Failed to decode event:', envelope.message.messageId)
    // ACK to prevent retry — bad data won't improve on retry
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  logger.info(`[ROAM Processor] Event: type=${event.type} msgId=${envelope.message.messageId}`)

  try {
    if (CHAT_EVENT_TYPES.has(event.type)) {
      await processMessage(event as RoamChatEvent)
    } else if (event.type === 'transcript.saved') {
      await processTranscript(event as RoamTranscriptEvent)
    } else if (event.type === 'reaction.added') {
      logger.info(`[ROAM Processor] Reaction: ${(event as RoamReactionEvent).data.emoji}`)
    } else {
      logger.info(`[ROAM Processor] Unhandled event type: ${event.type}`)
    }
  } catch (error) {
    logger.error('[ROAM Processor] Processing error:', error)

    // Detect 401 — key revoked
    if (error instanceof RoamApiError && error.status === 401) {
      const decoded = Buffer.from(envelope.message.data, 'base64').toString('utf-8')
      const parsed = JSON.parse(decoded) as { data?: { chat?: { id?: string }; group_id?: string } }
      const groupId = parsed.data?.chat?.id || parsed.data?.group_id || ''
      if (groupId) {
        const integration = await prisma.roamIntegration.findFirst({
          where: { targetGroupId: groupId },
          select: { tenantId: true, userId: true },
        })
        if (integration) {
          await handleKeyRevoked(integration.tenantId, integration.userId)
        }
      }
    }

    // Write to dead letter queue
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    const errorStatus = error instanceof RoamApiError ? error.status : undefined
    await writeDeadLetter({
      tenantId: 'unknown', // best-effort — tenant may not be resolved yet
      pubsubMessageId: envelope.message.messageId,
      eventType: event.type,
      payload: event as unknown as Record<string, unknown>,
      errorMessage: errorMsg,
      errorStatus,
    })

    // Return 500 so Pub/Sub retries (up to max-delivery-attempts)
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}

// ── Tenant resolution ────────────────────────────────────────────

async function resolveTenant(groupId: string): Promise<TenantContext> {
  // Look up per-tenant integration by target group
  const integration = await prisma.roamIntegration.findFirst({
    where: { targetGroupId: groupId, status: 'connected' },
  })

  let apiKey: string | null = null
  let personalityPrompt: string | null = null

  if (integration?.apiKeyEncrypted) {
    try {
      apiKey = await decryptKey(integration.apiKeyEncrypted)
    } catch (error) {
      logger.error('[ROAM Processor] Key decryption failed for tenant:', integration.tenantId, error)
    }
  }

  const tenantId = integration?.tenantId || 'default'
  const userId = integration?.userId || ROAM_DEFAULT_USER_ID

  // Load persona for personality context
  const persona = await prisma.mercuryPersona.findUnique({
    where: { tenantId },
    select: { personalityPrompt: true },
  })
  if (persona) {
    personalityPrompt = persona.personalityPrompt
  }

  return { tenantId, userId, apiKey, personalityPrompt }
}

// ── Message processor ──────────────────────────────────────────────

async function processMessage(event: RoamChatEvent): Promise<void> {
  const d = event.data

  // Normalize across ROAM event shapes:
  //   chat.message.dm/group: data.sender.id, data.chat.id, data.text
  //   message.created:       data.sender_id, data.group_id, data.text
  const text = d.text || ''
  const messageId = d.id || String(d.timestamp || '')
  const groupId = d.chat?.id || d.group_id || ''
  const senderId = d.sender?.id || d.sender_id || ''
  const senderName = d.sender?.name || d.sender_name
  const senderEmail = d.sender?.email || ''
  const threadId = d.thread_id

  // S02: Extract chat Tagged UUID (C-xxx or G-xxx) for v0 chat.post reply-in-context
  const chatId = d.chat?.id || ''
  const threadTimestamp = d.threadTimestamp || null

  // GAP 1: Generate stable queryId upfront — links inbound→outbound→Block Kit feedback
  const queryId = randomUUID()

  if (!text.trim()) {
    logger.info('[ROAM Processor] Empty message — skipping')
    return
  }

  // Self-loop prevention: skip messages sent by Mercury itself
  const SELF_IDS = new Set(['mercury', 'm.e.r.c.u.r.y', 'mercury-bot'])
  if (SELF_IDS.has(senderId.toLowerCase()) || senderName?.toLowerCase() === 'm.e.r.c.u.r.y') {
    logger.info(`[ROAM Processor] Self-loop prevented — sender: ${senderId} (${senderName})`)
    return
  }

  // Deduplicate by external message ID
  const existing = await prisma.mercuryThreadMessage.findFirst({
    where: {
      metadata: { path: ['roamMessageId'], equals: messageId },
    },
  })
  if (existing) {
    logger.info(`[ROAM Processor] Duplicate message ${messageId} — skipping`)
    return
  }

  // Resolve tenant from groupId
  const tenant = await resolveTenant(groupId)
  const userId = tenant.userId

  if (!userId) {
    logger.error('[ROAM Processor] No userId resolved for group:', groupId)
    return
  }

  // mentionOnly enforcement: skip non-mention group messages
  // BUG-1 fix: DMs always bypass mentionOnly — it only applies to group messages
  const isDM = event.type === 'chat.message.dm'
  if (!isDM && tenant.tenantId !== 'default') {
    const integration = await prisma.roamIntegration.findFirst({
      where: { tenantId: tenant.tenantId, status: 'connected' },
      select: { mentionOnly: true },
    })
    if (integration?.mentionOnly) {
      // BUG-2 fix: match Mercury-specific mentions, not any @username
      // BUG-3 fix: removed dead 'chat.message.mention' event type check
      const mentionPatterns = ['@mercury', '@m.e.r.c.u.r.y']
      const textLower = text.toLowerCase()
      const isMention = mentionPatterns.some(p => textLower.includes(p))
      if (!isMention) {
        logger.info(`[ROAM Processor] Skipping non-mention message for tenant ${tenant.tenantId} (mentionOnly=true)`)
        return
      }
    }
  }

  // S02/S05: Send typing indicator via v0 (chat Tagged UUID) with v1 fallback
  if (chatId) {
    chatTypingV0(chatId, tenant.apiKey || undefined)
  } else {
    sendTypingIndicator(groupId, tenant.apiKey || undefined)
  }

  // Strip @mention prefix from query (e.g. "@M.E.R.C.U.R.Y what is TUMM?" → "what is TUMM?")
  const queryText = text.replace(/^@\S+\s*/i, '').trim() || text

  // 1. GAP 1: Write inbound message with full conversation context
  await writeMercuryThreadMessage(userId, 'user', text, undefined, {
    direction: 'inbound',
    channel: 'roam',
    sourceGroupId: groupId,
    sourceGroupName: groupId, // Tagged UUID — resolved by frontend via group list
    roamMessageId: messageId,
    roamThreadId: threadId || threadTimestamp,
    senderId,
    senderName,
    senderEmail: senderEmail || undefined,
    queryId, // Links this inbound message to the outbound response + feedback
    tenantId: tenant.tenantId,
    timestamp: new Date().toISOString(),
  })

  // 2. Query Go backend RAG pipeline
  let replyText: string
  let confidence: number | undefined
  let citations: Citation[] = []

  try {
    const ragBody: Record<string, unknown> = {
      query: queryText,
      mode: 'concise',
      privilegeMode: false,
      maxTier: 3,
      history: [],
    }

    // Include persona personality context if available
    if (tenant.personalityPrompt) {
      ragBody.systemPrompt = tenant.personalityPrompt
    }

    const ragResponse = await fetch(`${GO_BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_AUTH_SECRET,
        'X-User-ID': userId,
      },
      body: JSON.stringify(ragBody),
    })

    if (!ragResponse.ok) {
      logger.error(`[ROAM Processor] RAG backend error: ${ragResponse.status}`)
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
    logger.error('[ROAM Processor] RAG query failed:', error)
    replyText = formatErrorForRoam('INTERNAL_ERROR')
  }

  if (!replyText) {
    replyText = formatErrorForRoam()
  }

  // 3. S02+S05: Reply via v0 chat.post with Block Kit, fallback to v1 sendMessage
  const isSilence = !!(confidence !== undefined && confidence < SILENCE_THRESHOLD)

  try {
    let sent = false

    // Try v0 chat.post first (reply-in-context + Block Kit)
    if (chatId) {
      // S05: Build Block Kit response for rich formatting
      const blockKit = buildBlockKitResponse(replyText, citations, confidence, queryId, isSilence)
      sent = await chatPost(
        chatId,
        replyText, // fallback text (if blocks fail)
        threadTimestamp,
        blockKit.blocks,
        blockKit.color,
        tenant.apiKey || undefined
      )
      if (sent) {
        logger.info(`[ROAM Processor] Reply via chat.post (Block Kit) to chat=${chatId} tenant=${tenant.tenantId} (confidence: ${confidence ?? 'N/A'})`)
      }
    }

    // Fall back to v1 sendMessage (plain text) if chat.post failed or no chatId
    if (!sent) {
      await sendMessage(
        { groupId, text: replyText, threadId: threadId || undefined },
        tenant.apiKey || undefined
      )
      logger.info(`[ROAM Processor] Reply via sendMessage to group=${groupId} tenant=${tenant.tenantId} (confidence: ${confidence ?? 'N/A'})`)
    }
  } catch (error) {
    logger.error('[ROAM Processor] ROAM send failed:', error)
    // Still write to thread — reply failed but we have the content
  }

  // 4. GAP 1: Write outbound response with queryId + citation doc IDs
  await writeMercuryThreadMessage(userId, 'assistant', replyText, confidence, {
    direction: 'outbound',
    channel: 'roam',
    sourceGroupId: groupId,
    roamMessageId: String(Date.now()), // response timestamp
    roamThreadId: threadId || threadTimestamp,
    senderId: 'mercury',
    queryId, // Same UUID — links feedback clicks back to this specific response
    citations: citations.map(c => c.documentId).filter(Boolean),
    citationCount: citations.length,
    tenantId: tenant.tenantId,
    timestamp: new Date().toISOString(),
  })

  // 5. Write audit record
  await writeAuditRecord(userId, queryText, replyText, confidence, groupId)
}

// ── Transcript processor ───────────────────────────────────────────

async function processTranscript(event: RoamTranscriptEvent): Promise<void> {
  const d = event.data
  const transcriptId = d.transcript_id
  const groupId = d.chat?.id || d.group_id || ''

  if (!transcriptId) {
    logger.info('[ROAM Processor] transcript.saved missing transcript_id — skipping')
    return
  }

  // Resolve tenant from groupId
  const tenant = await resolveTenant(groupId)
  const userId = tenant.userId

  if (!userId) {
    logger.error('[ROAM Processor] No userId resolved for transcript group:', groupId)
    return
  }

  // Check if meeting summaries are enabled for this tenant
  if (tenant.tenantId !== 'default') {
    const integration = await prisma.roamIntegration.findUnique({
      where: { tenantId: tenant.tenantId },
      select: { meetingSummaries: true },
    })
    if (integration && !integration.meetingSummaries) {
      logger.info(`[ROAM Processor] Meeting summaries disabled for tenant ${tenant.tenantId} — skipping`)
      return
    }
  }

  // Fetch transcript from ROAM
  let transcript
  try {
    transcript = await getTranscriptInfo(transcriptId, tenant.apiKey || undefined)
  } catch (error) {
    logger.error('[ROAM Processor] Transcript fetch failed:', error)
    return
  }

  const transcriptContent = transcript.content || ''
  if (!transcriptContent.trim()) {
    logger.info('[ROAM Processor] Empty transcript content — skipping')
    return
  }

  // Send to Go backend for summarization
  let summaryText: string
  try {
    const ragResponse = await fetch(`${GO_BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_AUTH_SECRET,
        'X-User-ID': userId,
      },
      body: JSON.stringify({
        query: `Summarize this meeting transcript. Include key discussion points, decisions made, and action items:\n\n${transcriptContent.slice(0, 8000)}`,
        mode: 'concise',
        privilegeMode: false,
        maxTier: 3,
        history: [],
      }),
    })

    if (!ragResponse.ok) {
      logger.error(`[ROAM Processor] RAG summarization error: ${ragResponse.status}`)
      return
    }

    const responseText = await ragResponse.text()
    const parsed = parseSSEText(responseText)
    summaryText = parsed.text
  } catch (error) {
    logger.error('[ROAM Processor] Transcript summarization failed:', error)
    return
  }

  if (!summaryText.trim()) {
    logger.info('[ROAM Processor] Empty summary generated — skipping')
    return
  }

  // Format summary for ROAM
  const formattedSummary = formatMeetingSummary(
    transcript.title || 'Meeting',
    transcript.participants || [],
    summaryText,
    transcript.duration
  )

  // Post summary to source group
  try {
    await sendMessage(
      { groupId, text: formattedSummary },
      tenant.apiKey || undefined
    )
    logger.info(`[ROAM Processor] Meeting summary sent to group=${groupId} transcript=${transcriptId}`)
  } catch (error) {
    logger.error('[ROAM Processor] Summary send failed:', error)
  }

  // Store transcript as document in Vault for indexing
  try {
    await prisma.document.create({
      data: {
        tenantId: tenant.tenantId,
        userId,
        filename: `roam-transcript-${transcriptId.slice(0, 8)}.txt`,
        originalName: transcript.title || `Meeting Transcript — ${new Date().toISOString().split('T')[0]}`,
        mimeType: 'text/plain',
        fileType: 'txt',
        sizeBytes: Buffer.byteLength(transcriptContent, 'utf-8'),
        extractedText: transcriptContent,
        indexStatus: 'Pending',
        metadata: {
          source: 'roam_transcript',
          transcriptId,
          groupId,
          participants: transcript.participants,
          duration: transcript.duration,
        },
      },
    })
  } catch (error) {
    logger.error('[ROAM Processor] Transcript document creation failed:', error)
  }

  // Write to Mercury Thread
  await writeMercuryThreadMessage(userId, 'assistant', formattedSummary, undefined, {
    roamGroupId: groupId,
    transcriptId,
    type: 'meeting_summary',
    tenantId: tenant.tenantId,
  })

  // Audit record
  try {
    await prisma.mercuryAction.create({
      data: {
        userId,
        actionType: 'roam_meeting_summary',
        status: 'completed',
        metadata: {
          channel: 'roam',
          transcriptId,
          groupId,
          summaryLength: formattedSummary.length,
          participantCount: transcript.participants?.length || 0,
        } as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    logger.error('[ROAM Processor] Meeting summary audit write failed:', error)
  }
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
    logger.error('[ROAM Processor] Mercury thread write failed:', error)
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
    logger.error('[ROAM Processor] Audit write failed:', error)
  }
}
