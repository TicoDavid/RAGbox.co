/**
 * ROAM Dead Letter Queue Writer
 *
 * Captures failed ROAM events for replay. Deduplicates by pubsubMessageId
 * and writes an audit MercuryAction on each DLQ write.
 *
 * STORY-104 — EPIC-010
 */

import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'

export interface DeadLetterInput {
  tenantId: string
  pubsubMessageId: string
  eventType: string
  payload: Record<string, unknown>
  errorMessage: string
  errorStatus?: number
}

/**
 * Write a failed event to the dead letter queue.
 * Upserts by pubsubMessageId — increments attemptCount on duplicates.
 */
export async function writeDeadLetter(input: DeadLetterInput): Promise<void> {
  try {
    await prisma.roamDeadLetter.upsert({
      where: { pubsubMessageId: input.pubsubMessageId },
      create: {
        tenantId: input.tenantId,
        pubsubMessageId: input.pubsubMessageId,
        eventType: input.eventType,
        payload: input.payload as Prisma.InputJsonValue,
        errorMessage: input.errorMessage,
        errorStatus: input.errorStatus ?? null,
        attemptCount: 1,
      },
      update: {
        attemptCount: { increment: 1 },
        errorMessage: input.errorMessage,
        errorStatus: input.errorStatus ?? null,
      },
    })

    // Audit trail
    await prisma.mercuryAction.create({
      data: {
        userId: 'system',
        actionType: 'roam_dlq_write',
        status: 'completed',
        metadata: {
          tenantId: input.tenantId,
          pubsubMessageId: input.pubsubMessageId,
          eventType: input.eventType,
          errorStatus: input.errorStatus,
        } as Prisma.InputJsonValue,
      },
    })
  } catch (error) {
    // DLQ write itself should never crash the caller
    console.error('[ROAM DLQ] Write failed:', error)
  }
}
