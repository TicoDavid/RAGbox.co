/**
 * ROAM Disconnect — POST /api/integrations/roam/disconnect
 *
 * Clears the encrypted API key and sets status to 'disconnected'.
 *
 * STORY-101 — EPIC-010
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

const DEFAULT_TENANT = 'default'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const tenantId = DEFAULT_TENANT

  const existing = await prisma.roamIntegration.findUnique({
    where: { tenantId },
  })

  if (!existing) {
    return NextResponse.json({ success: false, error: 'No ROAM integration found' }, { status: 404 })
  }

  const integration = await prisma.roamIntegration.update({
    where: { tenantId },
    data: {
      apiKeyEncrypted: null,
      status: 'disconnected',
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      id: integration.id,
      status: integration.status,
    },
  })
}
