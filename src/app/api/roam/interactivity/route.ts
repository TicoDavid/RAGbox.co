/**
 * ROAM Interactivity URL Handler — POST /api/roam/interactivity
 *
 * Handles Block Kit interactive button clicks from ROAM.
 * Must respond within 3 seconds — process everything async.
 *
 * Actions:
 *   - feedback_positive → log positive feedback for query
 *   - feedback_negative → log negative feedback
 *   - view_source       → no-op (URL buttons don't hit this endpoint)
 *   - escalate          → create Mercury notification for human review
 *   - mark_resolved     → update thread status
 *   - default           → log unknown action, no crash
 *
 * Reuses Standard Webhooks signature verification from /api/webhooks/roam.
 *
 * EPIC-018 S04
 */

import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { verifyWebhookSignature } from '@/lib/roam/roamVerify'
import { logger } from '@/lib/logger'

// Force Node.js runtime — required for crypto.createHmac
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROAM_WEBHOOK_SECRET = process.env.ROAM_WEBHOOK_SECRET || ''

// ── Payload shape ──────────────────────────────────────────────────

interface InteractivityPayload {
  type: string // 'block_actions'
  clientId?: string
  user?: {
    id: string
    email?: string
    name?: string
  }
  message?: {
    chatId: string
    timestamp: number
    threadTimestamp?: number
  }
  blockId?: string
  actionId: string
  value?: string
}

// ── Route handler ──────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Step 1: Read raw body
  let rawBody: string
  try {
    const rawBytes = await request.arrayBuffer()
    rawBody = new TextDecoder('utf-8').decode(rawBytes)
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  // Step 2: Verify Standard Webhooks signature (reuse same logic as /api/webhooks/roam)
  if (ROAM_WEBHOOK_SECRET) {
    const webhookId = request.headers.get('webhook-id') || ''
    const webhookTimestamp = request.headers.get('webhook-timestamp') || ''
    const webhookSignature = request.headers.get('webhook-signature') || ''

    try {
      const verification = verifyWebhookSignature(
        rawBody,
        {
          'webhook-id': webhookId,
          'webhook-timestamp': webhookTimestamp,
          'webhook-signature': webhookSignature,
        },
        ROAM_WEBHOOK_SECRET
      )

      if (!verification.valid) {
        logger.error(`[ROAM Interactivity] Signature failed: ${verification.error}`)
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    } catch (error) {
      logger.error('[ROAM Interactivity] Signature verification threw:', error)
      // Still process — don't let signature code crash the handler
    }
  }

  // Step 3: Return 200 OK immediately (must respond within 3 seconds)
  // Parse payload and process async
  let payload: InteractivityPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Fire-and-forget async processing — DO NOT AWAIT
  processInteraction(payload).catch(error => {
    logger.error('[ROAM Interactivity] Async processing failed:', error)
  })

  return NextResponse.json({ ok: true }, { status: 200 })
}

// ── Async processor ────────────────────────────────────────────────

async function processInteraction(payload: InteractivityPayload): Promise<void> {
  const { actionId, value, user, message } = payload

  logger.info(
    `[ROAM Interactivity] action=${actionId} value=${value} ` +
    `user=${user?.id || 'unknown'} chat=${message?.chatId || 'unknown'}`
  )

  // Step 5: Audit log for every interaction
  await writeInteractionAudit(payload)

  // Step 4: Route by actionId
  switch (actionId) {
    case 'feedback_positive':
      await handleFeedback(payload, 'positive')
      break

    case 'feedback_negative':
      await handleFeedback(payload, 'negative')
      break

    case 'view_source':
      // URL buttons don't hit this endpoint — no-op
      logger.info('[ROAM Interactivity] view_source — no-op (URL button)')
      break

    case 'escalate':
      await handleEscalate(payload)
      break

    case 'mark_resolved':
      await handleMarkResolved(payload)
      break

    default:
      logger.warn(`[ROAM Interactivity] Unknown actionId: ${actionId} — ignoring`)
      break
  }
}

// ── Action handlers ────────────────────────────────────────────────

async function handleFeedback(
  payload: InteractivityPayload,
  sentiment: 'positive' | 'negative'
): Promise<void> {
  const queryId = payload.value || ''
  const userId = payload.user?.id || ''

  try {
    await prisma.mercuryAction.create({
      data: {
        userId: userId || 'unknown',
        actionType: `roam_feedback_${sentiment}`,
        status: 'completed',
        metadata: {
          channel: 'roam',
          sentiment,
          queryId,
          chatId: payload.message?.chatId,
          userEmail: payload.user?.email,
          timestamp: payload.message?.timestamp,
        } as Prisma.InputJsonValue,
      },
    })
    logger.info(`[ROAM Interactivity] Feedback recorded: ${sentiment} for query=${queryId}`)
  } catch (error) {
    logger.error('[ROAM Interactivity] Feedback write failed:', error)
  }
}

async function handleEscalate(payload: InteractivityPayload): Promise<void> {
  const queryId = payload.value || ''
  const userId = payload.user?.id || ''

  try {
    // Create Mercury notification for human review
    await prisma.mercuryAction.create({
      data: {
        userId: userId || 'unknown',
        actionType: 'roam_escalation',
        status: 'pending',
        metadata: {
          channel: 'roam',
          queryId,
          chatId: payload.message?.chatId,
          threadTimestamp: payload.message?.threadTimestamp,
          userEmail: payload.user?.email,
          requestedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    })
    logger.info(`[ROAM Interactivity] Escalation created for query=${queryId} by user=${userId}`)
  } catch (error) {
    logger.error('[ROAM Interactivity] Escalation write failed:', error)
  }
}

async function handleMarkResolved(payload: InteractivityPayload): Promise<void> {
  const queryId = payload.value || ''
  const userId = payload.user?.id || ''

  try {
    await prisma.mercuryAction.create({
      data: {
        userId: userId || 'unknown',
        actionType: 'roam_thread_resolved',
        status: 'completed',
        metadata: {
          channel: 'roam',
          queryId,
          chatId: payload.message?.chatId,
          threadTimestamp: payload.message?.threadTimestamp,
          resolvedBy: payload.user?.email || userId,
          resolvedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    })
    logger.info(`[ROAM Interactivity] Thread resolved for query=${queryId} by user=${userId}`)
  } catch (error) {
    logger.error('[ROAM Interactivity] Mark resolved write failed:', error)
  }
}

// ── Audit writer ───────────────────────────────────────────────────

async function writeInteractionAudit(payload: InteractivityPayload): Promise<void> {
  try {
    await prisma.mercuryAction.create({
      data: {
        userId: payload.user?.id || 'unknown',
        actionType: 'roam_interaction',
        status: 'completed',
        metadata: {
          channel: 'roam',
          actionId: payload.actionId,
          value: payload.value,
          userId: payload.user?.id,
          chatId: payload.message?.chatId,
          timestamp: payload.message?.timestamp,
          blockId: payload.blockId,
          clientId: payload.clientId,
        } as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    logger.error('[ROAM Interactivity] Audit write failed:', error)
  }
}
