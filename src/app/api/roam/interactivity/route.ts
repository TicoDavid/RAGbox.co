/**
 * ROAM Interactivity URL Handler — POST /api/roam/interactivity
 *
 * Handles Block Kit interactive button clicks from ROAM.
 * Must respond within 3 seconds — process everything async.
 *
 * GAP 2: Every actionId writes to `roam_interactions` table (not just mercuryAction).
 * This feeds VERITAS analytics and the Intervention Data moat.
 *
 * Routing table:
 *   feedback_positive → roam_interactions                    → VERITAS quality score
 *   feedback_negative → roam_interactions + flag for review  → VERITAS + review alert
 *   escalate          → roam_interactions + Mercury notif    → ARGUS intervention record
 *   mark_resolved     → roam_interactions + status update    → VERITAS resolution metrics
 *   view_source       → no-op (URL buttons don't hit this)
 *   default           → roam_interactions (unknown action)
 *
 * Reuses Standard Webhooks signature verification from /api/webhooks/roam.
 *
 * EPIC-018 S04 + GAP 2
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

  // GAP 2: Write EVERY interaction to roam_interactions table — no exceptions
  await writeRoamInteraction(payload)

  // Route by actionId — additional actions per routing table
  switch (actionId) {
    case 'feedback_positive':
      // roam_interactions write is sufficient. Future: → VERITAS quality score
      logger.info(`[ROAM Interactivity] Positive feedback for query=${value}`)
      break

    case 'feedback_negative':
      // GAP 2: Also flag for human review queue
      await flagForHumanReview(payload)
      break

    case 'view_source':
      // URL buttons don't hit this endpoint — no-op
      logger.info('[ROAM Interactivity] view_source — no-op (URL button)')
      break

    case 'escalate':
      // GAP 2: Create Mercury notification for human agent pickup
      await createEscalationNotification(payload)
      break

    case 'mark_resolved':
      // GAP 2: Update conversation status to resolved
      await markConversationResolved(payload)
      break

    default:
      logger.warn(`[ROAM Interactivity] Unknown actionId: ${actionId} — logged to roam_interactions`)
      break
  }
}

// ── GAP 2: roam_interactions writer ────────────────────────────────

/**
 * Write to roam_interactions table. This is the primary data sink for
 * VERITAS analytics and Intervention Data moat. Every click is captured.
 */
async function writeRoamInteraction(payload: InteractivityPayload): Promise<void> {
  try {
    await prisma.roamInteraction.create({
      data: {
        queryId: payload.value || 'unknown', // query_id from Block Kit button value
        actionId: payload.actionId,
        value: payload.value,
        userId: payload.user?.id || 'unknown',
        userEmail: payload.user?.email || null,
        chatId: payload.message?.chatId || null,
        channel: 'roam',
      },
    })
    logger.info(
      `[ROAM Interactivity] Wrote to roam_interactions: action=${payload.actionId} query=${payload.value}`
    )
  } catch (error) {
    logger.error('[ROAM Interactivity] roam_interactions write failed:', error)
  }
}

// ── GAP 2: Routing actions ─────────────────────────────────────────

/**
 * feedback_negative → Flag query for human review queue.
 * Creates a pending MercuryAction that surfaces in the review dashboard.
 */
async function flagForHumanReview(payload: InteractivityPayload): Promise<void> {
  const queryId = payload.value || ''
  const userId = payload.user?.id || 'unknown'

  try {
    await prisma.mercuryAction.create({
      data: {
        userId,
        actionType: 'roam_feedback_review',
        status: 'pending', // Pending = needs human attention
        metadata: {
          channel: 'roam',
          trigger: 'feedback_negative',
          queryId,
          chatId: payload.message?.chatId,
          userEmail: payload.user?.email,
          flaggedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    })
    logger.info(`[ROAM Interactivity] Flagged for review: query=${queryId} by user=${userId}`)
  } catch (error) {
    logger.error('[ROAM Interactivity] Flag for review failed:', error)
  }
}

/**
 * escalate → Create Mercury notification for human agent pickup.
 * This is an Intervention Data point for the ARGUS moat.
 */
async function createEscalationNotification(payload: InteractivityPayload): Promise<void> {
  const queryId = payload.value || ''
  const userId = payload.user?.id || 'unknown'

  try {
    await prisma.mercuryAction.create({
      data: {
        userId,
        actionType: 'roam_escalation',
        status: 'pending', // Pending = needs human agent
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
    logger.info(`[ROAM Interactivity] Escalation created: query=${queryId} by user=${userId}`)
  } catch (error) {
    logger.error('[ROAM Interactivity] Escalation create failed:', error)
  }
}

/**
 * mark_resolved → Update conversation status. Write resolution record
 * for VERITAS resolution metrics.
 */
async function markConversationResolved(payload: InteractivityPayload): Promise<void> {
  const queryId = payload.value || ''
  const userId = payload.user?.id || 'unknown'

  try {
    // Mark any pending escalation for this query as resolved
    await prisma.mercuryAction.updateMany({
      where: {
        actionType: { in: ['roam_escalation', 'roam_feedback_review'] },
        status: 'pending',
        metadata: { path: ['queryId'], equals: queryId },
      },
      data: {
        status: 'completed',
      },
    })

    // Write resolution record
    await prisma.mercuryAction.create({
      data: {
        userId,
        actionType: 'roam_thread_resolved',
        status: 'completed',
        metadata: {
          channel: 'roam',
          queryId,
          chatId: payload.message?.chatId,
          resolvedBy: payload.user?.email || userId,
          resolvedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    })

    logger.info(`[ROAM Interactivity] Thread resolved: query=${queryId} by user=${userId}`)
  } catch (error) {
    logger.error('[ROAM Interactivity] Mark resolved failed:', error)
  }
}
