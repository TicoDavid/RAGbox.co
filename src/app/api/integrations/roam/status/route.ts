/**
 * ROAM Status — GET /api/integrations/roam/status
 *
 * Returns connection state (never exposes the encrypted key).
 *
 * STORY-101 — EPIC-010
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

const DEFAULT_TENANT = 'default'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const tenantId = DEFAULT_TENANT

  const integration = await prisma.roamIntegration.findUnique({
    where: { tenantId },
    select: {
      id: true,
      status: true,
      targetGroupId: true,
      targetGroupName: true,
      mentionOnly: true,
      meetingSummaries: true,
      connectedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!integration) {
    return NextResponse.json({
      success: true,
      data: { status: 'not_configured' },
    })
  }

  return NextResponse.json({
    success: true,
    data: integration,
  })
}
