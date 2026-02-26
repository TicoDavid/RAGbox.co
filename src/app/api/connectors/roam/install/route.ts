/**
 * ROAM Connector Install — POST /api/connectors/roam/install
 *
 * 1. Validate creds via GET groups.list
 * 2. Encrypt + store API key in tenant config
 * 3. Auto-subscribe to all 7 ROAM webhook events (S03)
 * 4. Store subscription IDs for unsubscribe on disconnect
 * 5. Return connected status with workspace groups
 *
 * EPIC-018 S01
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { encryptKey } from '@/lib/utils/kms'
import { listGroupsWithKey } from '@/lib/roam/roamClient'
import { autoSubscribeWebhooks } from '@/lib/roam/roamWebhookV0'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const DEFAULT_TENANT = 'default'

interface InstallBody {
  clientId?: string
  apiKey?: string
  webhookSecret?: string
  defaultGroupId?: string
  responseMode?: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ status: 'error', message: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  const tenantId = DEFAULT_TENANT

  let body: InstallBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.apiKey?.trim()) {
    return NextResponse.json({ status: 'error', message: 'apiKey is required' }, { status: 400 })
  }

  const apiKey = body.apiKey.trim()

  // Step 1: Validate creds — GET groups.list with provided API key
  let groups: Awaited<ReturnType<typeof listGroupsWithKey>>
  try {
    groups = await listGroupsWithKey(apiKey)
  } catch (error) {
    const status = (error as { status?: number }).status
    if (status === 401 || status === 403) {
      return NextResponse.json({ status: 'error', message: 'Invalid API key' }, { status: 401 })
    }
    logger.error('[ROAM Install] Credential validation failed:', error)
    return NextResponse.json(
      { status: 'error', message: 'Failed to validate ROAM credentials' },
      { status: 502 }
    )
  }

  // Step 2: Encrypt API key via KMS
  let apiKeyEncrypted: string
  try {
    apiKeyEncrypted = await encryptKey(apiKey)
  } catch (error) {
    logger.error('[ROAM Install] KMS encryption failed:', error)
    return NextResponse.json({ status: 'error', message: 'Encryption failed' }, { status: 500 })
  }

  // Step 3: Auto-subscribe to ROAM webhooks (S03)
  const subResult = await autoSubscribeWebhooks(apiKey)
  if (subResult.errors.length > 0) {
    logger.warn('[ROAM Install] Some webhook subscriptions failed:', subResult.errors)
  }

  // Step 4: Store encrypted creds + subscription IDs in tenant config
  const integration = await prisma.roamIntegration.upsert({
    where: { tenantId },
    update: {
      userId,
      apiKeyEncrypted,
      webhookSubscriptionId: JSON.stringify(subResult.subscriptionIds),
      targetGroupId: body.defaultGroupId || null,
      status: 'connected',
      connectedAt: new Date(),
      errorReason: null,
    },
    create: {
      tenantId,
      userId,
      apiKeyEncrypted,
      webhookSubscriptionId: JSON.stringify(subResult.subscriptionIds),
      targetGroupId: body.defaultGroupId || null,
      status: 'connected',
      connectedAt: new Date(),
    },
  })

  logger.info(
    `[ROAM Install] Connected tenant=${tenantId} userId=${userId} ` +
    `groups=${groups.length} subscriptions=${subResult.subscriptionIds.length}`
  )

  // Step 5: Return success with workspace groups
  return NextResponse.json({
    status: 'connected',
    workspace: 'ConnexUS Ai Inc',
    groups: groups.map(g => ({
      id: g.id,
      name: g.name,
      description: g.description,
      memberCount: g.memberCount,
    })),
    subscriptions: subResult.subscriptionIds.length,
    integrationId: integration.id,
  })
}
