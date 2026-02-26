/**
 * ROAM Connector Groups — GET /api/connectors/roam/groups
 *
 * List available ROAM groups using stored tenant API key.
 * Returns array of { id, name, accessMode, type }.
 *
 * EPIC-018 S01
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { decryptKey } from '@/lib/utils/kms'
import { listGroupsWithKey } from '@/lib/roam/roamClient'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

const DEFAULT_TENANT = 'default'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const tenantId = DEFAULT_TENANT

  // Read stored API key
  const integration = await prisma.roamIntegration.findUnique({
    where: { tenantId },
    select: { apiKeyEncrypted: true, status: true },
  })

  if (!integration?.apiKeyEncrypted || integration.status !== 'connected') {
    return NextResponse.json(
      { error: 'ROAM not connected. Install the connector first.' },
      { status: 400 }
    )
  }

  let apiKey: string
  try {
    apiKey = await decryptKey(integration.apiKeyEncrypted)
  } catch (error) {
    logger.error('[ROAM Groups] Decryption failed:', error)
    return NextResponse.json({ error: 'Failed to decrypt stored key' }, { status: 500 })
  }

  try {
    const groups = await listGroupsWithKey(apiKey)
    return NextResponse.json(
      groups.map(g => ({
        id: g.id,
        name: g.name,
        accessMode: g.description || 'unknown',
        type: 'group',
      }))
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch groups'
    logger.error('[ROAM Groups] API error:', message)
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
