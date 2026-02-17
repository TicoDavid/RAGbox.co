/**
 * Audit Entries API - RAGbox.co
 *
 * GET /api/audit/entries — Paginated hash-chained audit entries
 * POST /api/audit/entries/verify — Verify audit chain integrity
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { verifyAuditChain } from '@/lib/audit/auditWriter'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || undefined
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  const where: Record<string, unknown> = { userId }
  if (action) where.action = action

  const [entries, total] = await Promise.all([
    prisma.auditEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        action: true,
        resourceId: true,
        details: true,
        entryHash: true,
        createdAt: true,
      },
    }),
    prisma.auditEntry.count({ where }),
  ])

  return NextResponse.json({ success: true, data: { entries, total, limit, offset } })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  let body: { action?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  if (body.action === 'verify') {
    const result = await verifyAuditChain()
    return NextResponse.json({ success: true, data: result })
  }

  return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
}
