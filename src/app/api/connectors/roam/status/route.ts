/**
 * ROAM Connector Status — GET /api/connectors/roam/status
 *
 * Returns connection state, webhook metadata, and message count.
 * Never exposes the encrypted API key.
 *
 * EPIC-018 S01
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { parseSubscriptionIds } from '@/lib/roam/roamWebhookV0'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const DEFAULT_TENANT = 'default'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const tenantId = DEFAULT_TENANT

  // BUG-039a: clientId/responseMode columns may not exist in DB yet (prisma db push
  // hasn't run). Try full select first, fall back to safe columns on P2022 error.
  let integration: Record<string, unknown> | null = null
  try {
    integration = await prisma.roamIntegration.findUnique({
      where: { tenantId },
      select: {
        id: true,
        status: true,
        clientId: true,
        targetGroupId: true,
        targetGroupName: true,
        responseMode: true,
        webhookSubscriptionId: true,
        connectedAt: true,
        lastHealthCheckAt: true,
        errorReason: true,
        updatedAt: true,
      },
    })
  } catch (error: unknown) {
    const prismaCode = (error as { code?: string })?.code
    if (prismaCode === 'P2022') {
      logger.warn('[ROAM Status] P2022 — new columns missing, using safe fallback')
      try {
        integration = await prisma.roamIntegration.findUnique({
          where: { tenantId },
          select: {
            id: true,
            status: true,
            targetGroupId: true,
            targetGroupName: true,
            webhookSubscriptionId: true,
            connectedAt: true,
            lastHealthCheckAt: true,
            errorReason: true,
            updatedAt: true,
          },
        })
      } catch (fallbackError) {
        logger.error('[ROAM Status] Fallback query also failed:', fallbackError)
      }
    } else {
      logger.error('[ROAM Status] Query failed:', error)
    }
  }

  if (!integration) {
    return NextResponse.json({
      connected: false,
      workspace: null,
      lastWebhook: null,
      messageCount: 0,
      subscriptionIds: [],
    })
  }

  // Count ROAM messages processed (from Mercury thread messages with channel=roam)
  let messageCount = 0
  try {
    messageCount = await prisma.mercuryThreadMessage.count({
      where: { channel: 'roam', role: 'user' },
    })
  } catch (error) {
    logger.warn('[ROAM Status] Message count query failed:', error)
  }

  // Parse stored subscription IDs (JSON array string)
  const subscriptionIds = parseSubscriptionIds(
    (integration as { webhookSubscriptionId?: string | null }).webhookSubscriptionId ?? null
  )

  return NextResponse.json({
    connected: (integration as { status?: string }).status === 'connected',
    workspace: (integration as { status?: string }).status === 'connected' ? 'ConnexUS Ai Inc' : null,
    lastWebhook: (integration as { lastHealthCheckAt?: string; updatedAt?: string }).lastHealthCheckAt
      || (integration as { updatedAt?: string }).updatedAt,
    messageCount,
    subscriptionIds,
    clientId: (integration as { clientId?: string }).clientId ?? null,
    targetGroupId: (integration as { targetGroupId?: string }).targetGroupId ?? null,
    targetGroupName: (integration as { targetGroupName?: string }).targetGroupName ?? null,
    responseMode: (integration as { responseMode?: string }).responseMode ?? null,
    error: (integration as { errorReason?: string }).errorReason ?? null,
  })
}
