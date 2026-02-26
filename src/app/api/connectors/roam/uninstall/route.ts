/**
 * ROAM Connector Uninstall — POST /api/connectors/roam/uninstall
 *
 * 1. Read stored subscription IDs
 * 2. Unsubscribe all webhooks via v0 API
 * 3. Clear stored creds from tenant config
 * 4. Return { status: "disconnected" }
 *
 * EPIC-018 S01
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { decryptKey } from '@/lib/utils/kms'
import { unsubscribeAllWebhooks, parseSubscriptionIds } from '@/lib/roam/roamWebhookV0'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const DEFAULT_TENANT = 'default'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ status: 'error', message: 'Authentication required' }, { status: 401 })
  }

  const tenantId = DEFAULT_TENANT

  const integration = await prisma.roamIntegration.findUnique({
    where: { tenantId },
    select: {
      apiKeyEncrypted: true,
      webhookSubscriptionId: true,
      status: true,
    },
  })

  if (!integration) {
    return NextResponse.json({ status: 'error', message: 'No ROAM integration found' }, { status: 404 })
  }

  // Step 1: Unsubscribe webhooks if we have a key and subscription IDs
  if (integration.apiKeyEncrypted && integration.webhookSubscriptionId) {
    try {
      const apiKey = await decryptKey(integration.apiKeyEncrypted)
      const subscriptionIds = parseSubscriptionIds(integration.webhookSubscriptionId)

      if (subscriptionIds.length > 0) {
        logger.info(`[ROAM Uninstall] Unsubscribing ${subscriptionIds.length} webhooks for tenant=${tenantId}`)
        await unsubscribeAllWebhooks(apiKey, subscriptionIds)
      }
    } catch (error) {
      // Don't fail the uninstall if webhook cleanup fails — still clear creds
      logger.error('[ROAM Uninstall] Webhook cleanup failed (continuing):', error)
    }
  }

  // Step 2: Clear stored creds from tenant config
  await prisma.roamIntegration.update({
    where: { tenantId },
    data: {
      apiKeyEncrypted: null,
      webhookSubscriptionId: null,
      status: 'disconnected',
      errorReason: null,
    },
  })

  logger.info(`[ROAM Uninstall] Disconnected tenant=${tenantId}`)

  return NextResponse.json({ status: 'disconnected' })
}
