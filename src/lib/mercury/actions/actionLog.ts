/**
 * Mercury Action Logging — EPIC-029
 *
 * Consolidated helpers for logging MercuryAction records and writing
 * action results to the unified Mercury thread. Extracted from inline
 * implementations in send-email/route.ts and send-sms/route.ts.
 */

import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { embedThreadMessage } from '@/lib/mercury/embedMessage'

/**
 * Create a MercuryAction audit record.
 */
export async function createAction(params: {
  userId: string
  actionType: string
  recipient: string
  subject?: string | null
  body: string
  status: 'pending' | 'completed' | 'failed'
  metadata?: Record<string, unknown>
  agentId?: string | null
}): Promise<string | null> {
  try {
    const action = await prisma.mercuryAction.create({
      data: {
        userId: params.userId,
        agentId: params.agentId ?? null,
        actionType: params.actionType,
        recipient: params.recipient,
        subject: params.subject ?? null,
        body: params.body,
        status: params.status,
        metadata: (params.metadata ?? {}) as Record<string, string>,
      },
      select: { id: true },
    })
    return action.id
  } catch (error) {
    logger.error('[Mercury ActionLog] Create failed:', error)
    return null
  }
}

/**
 * Mark a pending action as completed.
 */
export async function confirmAction(
  actionId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.mercuryAction.update({
      where: { id: actionId },
      data: {
        status: 'completed',
        ...(metadata ? { metadata: metadata as Record<string, string> } : {}),
      },
    })
  } catch (error) {
    logger.error('[Mercury ActionLog] Confirm failed:', error)
  }
}

/**
 * Mark a pending action as failed.
 */
export async function failAction(
  actionId: string,
  errorMessage: string,
): Promise<void> {
  try {
    await prisma.mercuryAction.update({
      where: { id: actionId },
      data: {
        status: 'failed',
        metadata: { error: errorMessage } as Record<string, string>,
      },
    })
  } catch (error) {
    logger.error('[Mercury ActionLog] Fail update failed:', error)
  }
}

/**
 * Write an action result to the user's Mercury unified thread.
 * Also embeds the message for RAG total recall.
 */
export async function writeActionToThread(params: {
  userId: string
  channel: 'email' | 'sms' | 'dashboard'
  content: string
}): Promise<void> {
  try {
    let thread = await prisma.mercuryThread.findFirst({
      where: { userId: params.userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    })
    if (!thread) {
      thread = await prisma.mercuryThread.create({
        data: { userId: params.userId, title: 'Mercury Thread' },
        select: { id: true },
      })
    }

    const msg = await prisma.mercuryThreadMessage.create({
      data: {
        threadId: thread.id,
        role: 'assistant',
        channel: params.channel,
        content: params.content,
      },
      select: { id: true },
    })

    // Embed for RAG total recall (fire-and-forget)
    embedThreadMessage(msg.id, params.content).catch(() => {})
  } catch (error) {
    logger.error('[Mercury ActionLog] Thread write failed:', error)
  }
}
