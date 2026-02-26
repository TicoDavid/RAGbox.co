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

  const integration = await prisma.roamIntegration.findUnique({
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
  const subscriptionIds = parseSubscriptionIds(integration.webhookSubscriptionId)

  return NextResponse.json({
    connected: integration.status === 'connected',
    workspace: integration.status === 'connected' ? 'ConnexUS Ai Inc' : null,
    lastWebhook: integration.lastHealthCheckAt || integration.updatedAt,
    messageCount,
    subscriptionIds,
    clientId: integration.clientId,
    targetGroupId: integration.targetGroupId,
    targetGroupName: integration.targetGroupName,
    responseMode: integration.responseMode,
    error: integration.errorReason,
  })
}
