/**
 * Slack Events API Webhook — EPIC-024
 *
 * POST /api/webhooks/slack
 *
 * Handles Slack Events API events:
 * - url_verification: responds with challenge (one-time setup)
 * - event_callback: processes messages (app_mention, message.im, message.channels)
 *
 * Flow: Slack message → extract text → Go backend RAG → reply in Slack thread
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import prisma from '@/lib/prisma'
import { parseSSEText } from '@/lib/mercury/sseParser'
import { postMessage, addReaction } from '@/lib/slack/slackClient'
import { logger } from '@/lib/logger'
import { embedThreadMessage } from '@/lib/mercury/embedMessage'
import type { Prisma } from '@prisma/client'
import { GO_BACKEND_URL } from '@/lib/backend-proxy'

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''
const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || ''
const SLACK_DEFAULT_USER_ID = process.env.SLACK_DEFAULT_USER_ID || process.env.ROAM_DEFAULT_USER_ID || ''
const SILENCE_THRESHOLD = 0.65

// Self-loop prevention: bot user ID (populated on first event)
let botUserId: string | null = null

/**
 * Verify Slack request signature using signing secret.
 */
function verifySlackSignature(
  signature: string | null,
  timestamp: string | null,
  body: string,
): boolean {
  if (!SLACK_SIGNING_SECRET || !signature || !timestamp) return false

  // Reject requests older than 5 minutes
  const ts = parseInt(timestamp, 10)
  if (Math.abs(Date.now() / 1000 - ts) > 300) return false

  const baseString = `v0:${timestamp}:${body}`
  const expected = 'v0=' + createHmac('sha256', SLACK_SIGNING_SECRET).update(baseString).digest('hex')

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

interface SlackEvent {
  type: string
  challenge?: string
  event?: {
    type: string
    user?: string
    bot_id?: string
    text?: string
    channel?: string
    ts?: string
    thread_ts?: string
    channel_type?: string
  }
  authorizations?: Array<{ user_id?: string }>
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text()

  // Verify signature in production
  if (SLACK_SIGNING_SECRET) {
    const signature = request.headers.get('x-slack-signature')
    const timestamp = request.headers.get('x-slack-request-timestamp')
    if (!verifySlackSignature(signature, timestamp, rawBody)) {
      logger.warn('[Slack] Invalid signature — rejecting')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
    }
  }

  let payload: SlackEvent
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // URL verification challenge (one-time during Slack App setup)
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  // Extract bot user ID from authorizations (first time)
  if (!botUserId && payload.authorizations?.[0]?.user_id) {
    botUserId = payload.authorizations[0].user_id
    logger.info('[Slack] Bot user ID resolved:', botUserId)
  }

  const event = payload.event
  if (!event || !event.text || !event.channel) {
    return NextResponse.json({ ok: true })
  }

  // Self-loop prevention: skip messages from the bot itself
  if (event.bot_id || (botUserId && event.user === botUserId)) {
    return NextResponse.json({ ok: true })
  }

  // Only respond to: app_mention, DMs (im), or group messages
  const isAppMention = event.type === 'app_mention'
  const isDM = event.channel_type === 'im'
  if (!isAppMention && !isDM) {
    return NextResponse.json({ ok: true })
  }

  // Process asynchronously — Slack requires 200 within 3 seconds
  processSlackMessage(event).catch(err => {
    logger.error('[Slack] Async processing error:', err)
  })

  return NextResponse.json({ ok: true })
}

async function processSlackMessage(event: NonNullable<SlackEvent['event']>): Promise<void> {
  const channel = event.channel!
  const messageTs = event.ts!
  const threadTs = event.thread_ts || messageTs

  // Strip @mention prefix
  const text = (event.text || '').replace(/<@[A-Z0-9]+>\s*/g, '').trim()
  if (!text) return

  // Add thinking reaction
  addReaction(channel, messageTs, 'hourglass_flowing_sand').catch(() => {})

  const userId = SLACK_DEFAULT_USER_ID

  // Write inbound to Mercury thread
  await writeSlackThreadMessage(userId, 'user', text, {
    channel: 'slack',
    direction: 'inbound',
    slackChannel: channel,
    slackTs: messageTs,
    slackUser: event.user,
  })

  // Query Go backend RAG
  let replyText: string
  let confidence: number | undefined

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
      replyText = 'I encountered an issue processing your request. Please try again.'
    } else {
      const responseText = await ragResponse.text()
      const parsed = parseSSEText(responseText)
      confidence = parsed.confidence

      if (parsed.isSilence || (confidence !== undefined && confidence < SILENCE_THRESHOLD)) {
        replyText = ':shushing_face: *Silence Protocol* — I cannot provide a confident answer based on the documents in your vault.'
        if (parsed.suggestions?.length) {
          replyText += '\n\nYou might try:\n' + parsed.suggestions.map(s => `• ${s}`).join('\n')
        }
      } else {
        replyText = parsed.text
        if (parsed.citations.length > 0) {
          const citationBlock = parsed.citations
            .map(c => `*[${c.index}]* ${c.documentName || 'Document'}: _"${(c.excerpt || '').slice(0, 100)}"_`)
            .join('\n')
          replyText += `\n\n:page_facing_up: *Sources*\n${citationBlock}`
        }
        if (confidence !== undefined && confidence < 0.75) {
          replyText += `\n\n:warning: Confidence: ${Math.round(confidence * 100)}%`
        }
      }
    }
  } catch (error) {
    logger.error('[Slack] RAG query failed:', error)
    replyText = 'I encountered an error processing your request.'
  }

  // Reply in thread
  await postMessage(channel, replyText, threadTs)

  // Remove thinking reaction, add checkmark
  addReaction(channel, messageTs, 'white_check_mark').catch(() => {})

  // Write outbound to Mercury thread
  await writeSlackThreadMessage(userId, 'assistant', replyText, {
    channel: 'slack',
    direction: 'outbound',
    slackChannel: channel,
    slackTs: messageTs,
    confidence,
  })
}

async function writeSlackThreadMessage(
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  metadata: Record<string, unknown>,
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

    const msg = await prisma.mercuryThreadMessage.create({
      data: {
        threadId: thread.id,
        role,
        channel: 'slack' as any,
        content,
        metadata: metadata as Prisma.InputJsonValue,
      },
      select: { id: true },
    })

    // Embed for RAG total recall (fire-and-forget) — S-P1-04
    embedThreadMessage(msg.id, content).catch(() => {})

    await prisma.mercuryThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    })
  } catch (err) {
    logger.error('[Slack] Thread write failed:', err)
  }
}
