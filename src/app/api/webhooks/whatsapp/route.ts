/**
 * WhatsApp Webhook Route - RAGbox.co
 *
 * Next.js API route for Vonage/Meta inbound webhook.
 * This route runs on Cloud Run (port 8080) so Vonage can reach it.
 * The server/whatsapp/webhook.ts runs on port 3003 (voice server) and is NOT deployed.
 *
 * GET  /api/webhooks/whatsapp — Verification challenge (Meta-style)
 * POST /api/webhooks/whatsapp — Inbound messages + status updates from Vonage
 */

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { parseSSEText } from '@/lib/mercury/sseParser'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'mercury-ragbox-verify'
const VONAGE_API_KEY = process.env.VONAGE_API_KEY || ''
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET || ''
const VONAGE_WHATSAPP_NUMBER = process.env.VONAGE_WHATSAPP_NUMBER || '14157386102'
const GO_BACKEND_URL = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''
const DEFAULT_USER_ID = process.env.WHATSAPP_DEFAULT_USER_ID || ''


// =============================================================================
// GET — Webhook verification (Meta-style hub.challenge)
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
    console.log('[Webhook] Verification challenge accepted')
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 })
}

// =============================================================================
// POST — Inbound messages from Vonage
// =============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'received' }, { status: 200 })
  }

  // Always respond 200 immediately — process async to avoid Vonage retry storms
  const messageUuid = (body.message_uuid as string) || ''

  // Fire-and-forget processing
  processWebhookPayload(body).catch((error) => {
    console.error('[Webhook] Async processing failed:', error)
  })

  console.log(`[Webhook] Received message_uuid=${messageUuid} — accepted`)
  return NextResponse.json({ status: 'received' }, { status: 200 })
}

// =============================================================================
// ASYNC PROCESSOR
// =============================================================================

async function processWebhookPayload(body: Record<string, unknown>): Promise<void> {
  const messageUuid = (body.message_uuid as string) || ''
  const messageType = body.message_type as string

  // Status update (no message_type, has status field)
  if (!messageType && body.status) {
    await processStatusUpdate(body)
    return
  }

  // Inbound message — needs message_type
  if (!messageType) {
    console.log('[Webhook] Unrecognized payload — ignored')
    return
  }

  // Deduplicate: check if we already processed this message_uuid
  if (messageUuid) {
    const existing = await prisma.whatsAppMessage.findFirst({
      where: { externalMessageId: messageUuid },
    })
    if (existing) {
      console.log(`[Webhook] Duplicate message_uuid=${messageUuid} — skipping`)
      return
    }
  }

  // Parse sender info
  const rawFrom = typeof body.from === 'object'
    ? ((body.from as Record<string, unknown>)?.number as string) || ''
    : (body.from as string) || ''
  const fromPhone = rawFrom.startsWith('+') ? rawFrom : `+${rawFrom}`

  if (!fromPhone || fromPhone === '+') {
    console.warn('[Webhook] No sender phone number — ignoring')
    return
  }

  const profile = body.profile as Record<string, unknown> | undefined
  const displayName = (profile?.name as string) || undefined
  const content = messageType === 'text' ? ((body.text as string) || '') : undefined

  const userId = DEFAULT_USER_ID
  if (!userId) {
    console.error('[Webhook] No WHATSAPP_DEFAULT_USER_ID configured — cannot route message')
    return
  }

  // Verify user exists before Prisma FK operations (BUG-034 fix)
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) {
    console.error(`[Webhook] WHATSAPP_DEFAULT_USER_ID="${userId}" does not exist in users table — fix env var`)
    return
  }

  try {
    // 1. Upsert contact
    const contact = await prisma.whatsAppContact.upsert({
      where: {
        userId_phoneNumber: { userId, phoneNumber: fromPhone },
      },
      update: { displayName: displayName || undefined },
      create: { userId, phoneNumber: fromPhone, displayName },
    })

    if (contact.isBlocked) {
      console.log(`[Webhook] Blocked contact ${fromPhone} — ignoring`)
      return
    }

    // 2. Upsert conversation
    const conversation = await prisma.whatsAppConversation.upsert({
      where: {
        userId_contactId: { userId, contactId: contact.id },
      },
      update: {},
      create: { userId, contactId: contact.id, autoReply: true },
    })

    if (conversation.status === 'blocked') {
      console.log('[Webhook] Blocked conversation — ignoring')
      return
    }

    // 3. Persist inbound message
    await prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        externalMessageId: messageUuid || null,
        direction: 'inbound',
        messageType: normalizeMessageType(messageType),
        content: content || null,
        status: 'delivered',
      },
    })

    // 4. Update conversation metadata
    const preview = content ? content.slice(0, 100) : `[${messageType}]`
    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageText: preview,
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
    })

    console.log(`[Webhook] Processed inbound from ${fromPhone}: ${preview}`)

    // 5. Write to Mercury Unified Thread (additive — WhatsApp data stays intact)
    if (content) {
      await writeMercuryThreadMessage(userId, 'user', 'whatsapp', content, undefined, { phone: fromPhone, displayName })
    }

    // 6. Auto-reply via RAG if enabled
    if (conversation.autoReply && messageType === 'text' && content) {
      await handleAutoReply(conversation.id, userId, fromPhone, content)
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`[Webhook] Prisma error ${error.code}: ${error.message}`, {
        code: error.code,
        meta: error.meta,
        model: (error.meta as Record<string, unknown>)?.modelName,
      })
      if (error.code === 'P2021') {
        console.error('[Webhook] Table does not exist — run WhatsApp migration: 20260215000000_add_content_intelligence_and_whatsapp')
      } else if (error.code === 'P2003') {
        console.error('[Webhook] Foreign key violation — verify WHATSAPP_DEFAULT_USER_ID exists in users table')
      }
    } else {
      console.error('[Webhook] Error processing inbound message:', error)
    }
  }
}

// =============================================================================
// STATUS UPDATE
// =============================================================================

async function processStatusUpdate(body: Record<string, unknown>): Promise<void> {
  const externalId = (body.message_uuid as string) || ''
  const status = body.status as string
  if (!externalId || !status) return

  try {
    const message = await prisma.whatsAppMessage.findFirst({
      where: { externalMessageId: externalId },
    })
    if (!message) return

    const normalized = normalizeStatus(status)
    await prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: { status: normalized },
    })
    console.log(`[Webhook] Status update: ${externalId} → ${normalized}`)
  } catch (error) {
    console.error('[Webhook] Status update error:', error)
  }
}

// =============================================================================
// AUTO-REPLY
// =============================================================================

async function handleAutoReply(
  conversationId: string,
  userId: string,
  toPhone: string,
  queryText: string,
): Promise<void> {
  try {
    // Call Go backend RAG pipeline (returns SSE stream)
    const ragResponse = await fetch(`${GO_BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_AUTH_SECRET,
        'X-User-ID': userId,
      },
      body: JSON.stringify({
        query: queryText,
        mode: 'concise',
        privilegeMode: false,
        maxTier: 3,
        history: [],
      }),
    })

    let replyText = ''
    let confidence: number | undefined
    let queryId: string | undefined

    if (ragResponse.ok) {
      const responseText = await ragResponse.text()
      const parsed = parseSSEText(responseText)
      confidence = parsed.confidence

      if (parsed.isSilence || (confidence !== undefined && confidence < 0.65)) {
        // Silence Protocol: clean user-friendly message
        replyText = "I don't have enough confidence to answer that accurately based on my current knowledge."
        if (parsed.suggestions && parsed.suggestions.length > 0) {
          replyText += '\n\nYou might try:\n' + parsed.suggestions.map((s) => `• ${s}`).join('\n')
        } else {
          replyText += '\n\nTry rephrasing your question, or upload documents that might contain the answer.'
        }
        replyText += '\n\n○ Confidence: Below threshold'
      } else {
        replyText = parsed.text
      }
    }

    if (!replyText) {
      if (!ragResponse.ok) {
        replyText = 'Mercury is temporarily unavailable. Please try again in a few minutes.'
      } else {
        replyText = "I wasn't able to find a relevant answer in the knowledge base for that question. Try rephrasing or asking about a specific document."
      }
    }

    // Truncate for WhatsApp (max 4096 chars)
    if (replyText.length > 4000) {
      replyText = replyText.slice(0, 3997) + '...'
    }

    // Send via Vonage Messages API (sandbox)
    const sendResult = await sendVonageText(toPhone, replyText)

    // Persist outbound message
    await prisma.whatsAppMessage.create({
      data: {
        conversationId,
        externalMessageId: sendResult.externalMessageId || null,
        direction: 'outbound',
        messageType: 'text',
        content: replyText,
        status: sendResult.success ? 'sent' : 'failed',
        confidence,
        queryId,
      },
    })

    // Update conversation
    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageText: replyText.slice(0, 100),
        lastMessageAt: new Date(),
      },
    })

    // Write auto-reply to Mercury Unified Thread
    await writeMercuryThreadMessage(userId, 'assistant', 'whatsapp', replyText, confidence, { phone: toPhone })

    console.log(`[Webhook] Auto-reply sent to ${toPhone} (confidence: ${confidence ?? 'N/A'})`)
  } catch (error) {
    console.error('[Webhook] Auto-reply failed:', error)
  }
}

// =============================================================================
// VONAGE SEND (inline — no provider import to avoid server-only deps)
// =============================================================================

async function sendVonageText(
  to: string,
  text: string,
): Promise<{ externalMessageId: string; success: boolean; error?: string }> {
  if (!VONAGE_API_KEY || !VONAGE_API_SECRET) {
    console.warn('[Webhook] Vonage credentials not configured — skipping send')
    return { externalMessageId: '', success: false, error: 'Vonage not configured' }
  }

  try {
    const auth = Buffer.from(`${VONAGE_API_KEY}:${VONAGE_API_SECRET}`).toString('base64')
    const response = await fetch('https://messages-sandbox.nexmo.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        message_type: 'text',
        text,
        to: to.replace('+', ''),
        from: VONAGE_WHATSAPP_NUMBER,
        channel: 'whatsapp',
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[Webhook] Vonage send failed:', response.status, errorBody)
      return { externalMessageId: '', success: false, error: `Vonage ${response.status}` }
    }

    const data = await response.json()
    return { externalMessageId: data.message_uuid || '', success: true }
  } catch (error) {
    console.error('[Webhook] Vonage send error:', error)
    return {
      externalMessageId: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// =============================================================================
// MERCURY UNIFIED THREAD WRITER
// =============================================================================

async function writeMercuryThreadMessage(
  userId: string,
  role: 'user' | 'assistant',
  channel: 'whatsapp',
  content: string,
  confidence?: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    // Get or create the user's active thread
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
        channel,
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
    // Non-fatal: WhatsApp processing continues even if thread write fails
    console.error('[Webhook] Mercury thread write failed:', error)
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function normalizeMessageType(type: string): 'text' | 'audio' | 'image' | 'document' | 'system' {
  switch (type) {
    case 'text': return 'text'
    case 'audio': return 'audio'
    case 'image': return 'image'
    case 'file':
    case 'document': return 'document'
    default: return 'text'
  }
}

function normalizeStatus(status: string): 'sent' | 'delivered' | 'read' | 'failed' {
  switch (status) {
    case 'submitted':
    case 'sent': return 'sent'
    case 'delivered': return 'delivered'
    case 'read': return 'read'
    case 'rejected':
    case 'failed':
    case 'undeliverable': return 'failed'
    default: return 'sent'
  }
}
