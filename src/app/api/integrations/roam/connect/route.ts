/**
 * ROAM Connect — POST /api/integrations/roam/connect
 *
 * Encrypts the tenant's ROAM API key via KMS, upserts RoamIntegration,
 * and sets status to 'connected'.
 *
 * STORY-101 — EPIC-010
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { encryptKey } from '@/lib/utils/kms'
import { logger } from '@/lib/logger'

const DEFAULT_TENANT = 'default'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  const tenantId = DEFAULT_TENANT

  let body: {
    apiKey?: string
    targetGroupId?: string
    targetGroupName?: string
    mentionOnly?: boolean
    meetingSummaries?: boolean
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.apiKey || !body.apiKey.trim()) {
    return NextResponse.json({ success: false, error: 'apiKey is required' }, { status: 400 })
  }

  // Encrypt the API key via KMS before storage
  let apiKeyEncrypted: string
  try {
    apiKeyEncrypted = await encryptKey(body.apiKey.trim())
  } catch (error) {
    logger.error('[ROAM Connect] KMS encryption failed:', error)
    return NextResponse.json({ success: false, error: 'Encryption failed' }, { status: 500 })
  }

  const integration = await prisma.roamIntegration.upsert({
    where: { tenantId },
    update: {
      userId,
      apiKeyEncrypted,
      targetGroupId: body.targetGroupId || null,
      targetGroupName: body.targetGroupName || null,
      mentionOnly: body.mentionOnly ?? true,
      meetingSummaries: body.meetingSummaries ?? true,
      status: 'connected',
      connectedAt: new Date(),
    },
    create: {
      tenantId,
      userId,
      apiKeyEncrypted,
      targetGroupId: body.targetGroupId || null,
      targetGroupName: body.targetGroupName || null,
      mentionOnly: body.mentionOnly ?? true,
      meetingSummaries: body.meetingSummaries ?? true,
      status: 'connected',
      connectedAt: new Date(),
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      id: integration.id,
      status: integration.status,
      targetGroupId: integration.targetGroupId,
      targetGroupName: integration.targetGroupName,
      mentionOnly: integration.mentionOnly,
      meetingSummaries: integration.meetingSummaries,
      connectedAt: integration.connectedAt,
    },
  })
}
