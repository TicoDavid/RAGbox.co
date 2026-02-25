/**
 * ROAM Groups — GET /api/integrations/roam/groups
 *
 * Lists available ROAM groups. Uses the stored encrypted key if connected,
 * or accepts an API key via X-Roam-Api-Key header for pre-connect validation.
 *
 * STORY-101 — EPIC-010
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { decryptKey } from '@/lib/utils/kms'
import { listGroupsWithKey } from '@/lib/roam/roamClient'
import { logger } from '@/lib/logger'

const DEFAULT_TENANT = 'default'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const tenantId = DEFAULT_TENANT

  // Resolve API key: header override (pre-connect validation) or stored key
  let apiKey: string | undefined

  const headerKey = request.headers.get('x-roam-api-key')
  if (headerKey) {
    apiKey = headerKey
  } else {
    const integration = await prisma.roamIntegration.findUnique({
      where: { tenantId },
      select: { apiKeyEncrypted: true, status: true },
    })

    if (!integration?.apiKeyEncrypted || integration.status !== 'connected') {
      return NextResponse.json(
        { success: false, error: 'ROAM not connected. Provide X-Roam-Api-Key header or connect first.' },
        { status: 400 }
      )
    }

    try {
      apiKey = await decryptKey(integration.apiKeyEncrypted)
    } catch (error) {
      logger.error('[ROAM Groups] Decryption failed:', error)
      return NextResponse.json({ success: false, error: 'Failed to decrypt stored key' }, { status: 500 })
    }
  }

  try {
    const groups = await listGroupsWithKey(apiKey)
    return NextResponse.json({ success: true, data: { groups } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch groups'
    logger.error('[ROAM Groups] API error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 502 })
  }
}
