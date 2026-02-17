/**
 * Admin Reindex Endpoint
 * POST /api/admin/reindex — Trigger indexing for all documents stuck in "Pending"
 * Protected by internal auth secret.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''
const GO_BACKEND_URL = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('x-internal-auth') || ''
  if (!INTERNAL_AUTH_SECRET || authHeader !== INTERNAL_AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { id: string; status: string }[] = []

  try {
    // Find all documents stuck in Pending
    const pending = await prisma.document.findMany({
      where: { indexStatus: 'Pending' },
      select: { id: true, userId: true, filename: true },
      take: 100, // Process in batches of 100
    })

    if (pending.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending documents', results: [] })
    }

    // Trigger ingest for each document via Go backend (concurrency = 5)
    const CONCURRENCY = 5
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      const batch = pending.slice(i, i + CONCURRENCY)
      const promises = batch.map(async (doc) => {
        try {
          const res = await fetch(
            new URL(`/api/documents/${doc.id}/ingest`, GO_BACKEND_URL).toString(),
            {
              method: 'POST',
              headers: {
                'Content-Length': '0',
                'X-Internal-Auth': INTERNAL_AUTH_SECRET,
                'X-User-ID': doc.userId,
              },
              signal: AbortSignal.timeout(15000),
            }
          )
          results.push({ id: doc.id, status: res.ok || res.status === 202 ? 'triggered' : `error-${res.status}` })
        } catch {
          results.push({ id: doc.id, status: 'unreachable' })
        }
      })
      await Promise.all(promises)
    }

    const triggered = results.filter(r => r.status === 'triggered').length
    const failed = results.length - triggered

    return NextResponse.json({
      success: true,
      message: `Reindex triggered for ${triggered}/${results.length} documents${failed > 0 ? ` (${failed} failed)` : ''}`,
      results,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Reindex failed',
      results,
    }, { status: 500 })
  }
}
