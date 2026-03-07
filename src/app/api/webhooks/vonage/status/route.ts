/**
 * Vonage SMS Delivery Receipts — S-P1-07
 *
 * POST /api/webhooks/vonage/status
 *
 * Receives SMS delivery status callbacks from Vonage:
 *   submitted → delivered → read (or failed/rejected)
 *
 * Updates the originating MercuryAction status for audit trail.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import type { Prisma } from '@prisma/client'

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'received' }, { status: 200 })
  }

  const messageUuid = (body.message_uuid as string) || ''
  const status = (body.status as string) || ''
  const timestamp = (body.timestamp as string) || new Date().toISOString()
  const errorCode = body.error ? (body.error as Record<string, unknown>)?.code : undefined
  const errorReason = body.error ? (body.error as Record<string, unknown>)?.reason : undefined

  // Always respond 200 to prevent Vonage retry storms
  if (!messageUuid || !status) {
    logger.info('[Vonage/Status] Payload missing message_uuid or status — ignored')
    return NextResponse.json({ status: 'received' }, { status: 200 })
  }

  logger.info('[Vonage/Status] Delivery receipt', { messageUuid, status })

  // Fire-and-forget: update MercuryAction
  persistDeliveryStatus(messageUuid, status, timestamp, errorCode, errorReason).catch((error) => {
    logger.error('[Vonage/Status] Persist failed:', error)
  })

  return NextResponse.json({ status: 'received' }, { status: 200 })
}

async function persistDeliveryStatus(
  messageUuid: string,
  status: string,
  timestamp: string,
  errorCode?: unknown,
  errorReason?: unknown,
): Promise<void> {
  const normalizedStatus = normalizeVonageStatus(status)

  // Find the MercuryAction that sent this SMS (messageUuid stored in metadata)
  const actions = await prisma.mercuryAction.findMany({
    where: {
      actionType: 'sms',
      metadata: {
        path: ['messageUuid'],
        equals: messageUuid,
      },
    },
    select: { id: true, metadata: true },
    take: 1,
  })

  if (actions.length === 0) {
    // Also check WhatsApp outbound messages
    const whatsappMsg = await prisma.whatsAppMessage.findFirst({
      where: { externalMessageId: messageUuid },
    })
    if (whatsappMsg) {
      await prisma.whatsAppMessage.update({
        where: { id: whatsappMsg.id },
        data: { status: normalizedStatus },
      })
      logger.info(`[Vonage/Status] WhatsApp message updated: ${messageUuid} → ${normalizedStatus}`)
      return
    }

    logger.info(`[Vonage/Status] No matching action for message_uuid=${messageUuid}`)
    return
  }

  const action = actions[0]
  const existingMeta = (action.metadata ?? {}) as Record<string, unknown>

  await prisma.mercuryAction.update({
    where: { id: action.id },
    data: {
      status: normalizedStatus === 'failed' ? 'failed' : 'completed',
      metadata: {
        ...existingMeta,
        deliveryStatus: status,
        deliveryTimestamp: timestamp,
        ...(errorCode ? { deliveryErrorCode: errorCode } : {}),
        ...(errorReason ? { deliveryErrorReason: errorReason } : {}),
      } as Prisma.InputJsonValue,
    },
  })

  logger.info(`[Vonage/Status] Updated action ${action.id}: ${status}`)
}

function normalizeVonageStatus(status: string): 'sent' | 'delivered' | 'read' | 'failed' {
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
