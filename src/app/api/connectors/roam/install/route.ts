/**
 * ROAM Connector Install — POST /api/connectors/roam/install
 *
 * 1. Validate creds via GET groups.list
 * 2. Encrypt + store API key and webhook secret in tenant config
 * 3. Auto-subscribe to all 7 ROAM webhook events (S03)
 * 4. Store all connector fields: clientId, webhookSecret, targetGroup, responseMode
 * 5. Return connected status with workspace groups
 *
 * EPIC-018 S01 — BUG-1 + BUG-2 hotfix
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

/**
 * Request body — matches Jordan's frontend (integrations/page.tsx lines 249-254).
 * BUG-1 fix: frontend sends `targetGroupId`, NOT `defaultGroupId`.
 */
interface InstallBody {
  clientId?: string
  apiKey?: string
  webhookSecret?: string
  targetGroupId?: string
  targetGroupName?: string
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

  // BUG-2 fix: Encrypt webhook secret if provided
  let webhookSecretEncrypted: string | null = null
  if (body.webhookSecret?.trim()) {
    try {
      webhookSecretEncrypted = await encryptKey(body.webhookSecret.trim())
    } catch (error) {
      logger.error('[ROAM Install] Webhook secret encryption failed:', error)
      return NextResponse.json({ status: 'error', message: 'Encryption failed' }, { status: 500 })
    }
  }

  // Step 3: Auto-subscribe to ROAM webhooks (S03)
  const subResult = await autoSubscribeWebhooks(apiKey)
  if (subResult.errors.length > 0) {
    logger.warn('[ROAM Install] Some webhook subscriptions failed:', subResult.errors)
  }

  // BUG-2 fix: Map responseMode → mentionOnly boolean
  //   'all'           → mentionOnly: false (respond to all messages)
  //   'mentions'      → mentionOnly: true  (only @mentions in groups, DMs always respond)
  //   'dms_mentions'  → mentionOnly: true  (DMs + @mentions — same backend behavior)
  const mentionOnly = body.responseMode !== 'all'

  // Step 4: Store ALL connector fields in tenant config
  // BUG-1 fix: Read targetGroupId (not defaultGroupId) — matches frontend field name
  // BUG-2 fix: Persist clientId, webhookSecret, targetGroupName, responseMode, mentionOnly
  const integration = await prisma.roamIntegration.upsert({
    where: { tenantId },
    update: {
      userId,
      apiKeyEncrypted,
      clientId: body.clientId?.trim() || null,
      webhookSecretEncrypted,
      webhookSubscriptionId: JSON.stringify(subResult.subscriptionIds),
      targetGroupId: body.targetGroupId || null,
      targetGroupName: body.targetGroupName || null,
      responseMode: body.responseMode || null,
      mentionOnly,
      status: 'connected',
      connectedAt: new Date(),
      errorReason: null,
    },
    create: {
      tenantId,
      userId,
      apiKeyEncrypted,
      clientId: body.clientId?.trim() || null,
      webhookSecretEncrypted,
      webhookSubscriptionId: JSON.stringify(subResult.subscriptionIds),
      targetGroupId: body.targetGroupId || null,
      targetGroupName: body.targetGroupName || null,
      responseMode: body.responseMode || null,
      mentionOnly,
      status: 'connected',
      connectedAt: new Date(),
    },
  })

  logger.info(
    `[ROAM Install] Connected tenant=${tenantId} userId=${userId} ` +
    `groups=${groups.length} subscriptions=${subResult.subscriptionIds.length} ` +
    `targetGroup=${body.targetGroupId || 'none'} responseMode=${body.responseMode || 'default'}`
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
