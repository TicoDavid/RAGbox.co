/**
 * RAGbox Public API — Knowledge Stats & Search
 *
 * GET  /api/v1/knowledge — Vault statistics
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey, hasScope } from '@/lib/api/apiKeyMiddleware'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateApiKey(request)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
  }

  if (!hasScope(auth, 'read')) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
  }

  const tenantId = auth.tenantId

  const [documentCount, privilegedCount, chunkStats, queryCount] = await Promise.all([
    prisma.document.count({
      where: { userId: auth.userId, tenantId, deletionStatus: 'Active' },
    }),
    prisma.document.count({
      where: { userId: auth.userId, tenantId, deletionStatus: 'Active', privilegeLevel: 'privileged' },
    }),
    prisma.document.aggregate({
      where: { userId: auth.userId, tenantId, deletionStatus: 'Active' },
      _sum: { chunkCount: true },
    }),
    prisma.mercuryAction.count({
      where: { userId: auth.userId, actionType: { in: ['query', 'roam_query'] } },
    }),
  ])

  return NextResponse.json({
    success: true,
    data: {
      documentCount,
      privilegedCount,
      chunkCount: chunkStats._sum.chunkCount || 0,
      embeddingDimensions: 768,
      queryCount,
    },
  })
}
