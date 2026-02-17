/**
 * ROAM Compliance Export API - RAGbox.co
 *
 * POST /api/roam/compliance — Trigger daily compliance export ingest
 *
 * Body: { date: "YYYY-MM-DD" } or { date: "yesterday" }
 * Auth: session (dashboard) or OIDC (Cloud Scheduler)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { ingestDailyCompliance } from '@/lib/roam/complianceIngest'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth: allow session auth OR OIDC tokens from Cloud Scheduler
  const token = await getToken({ req: request })
  const oidcAuth = request.headers.get('authorization')?.startsWith('Bearer ')
  if (!token && !oidcAuth) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  let date = 'yesterday'
  try {
    const body = await request.json()
    if (body.date) date = body.date
  } catch {
    // Use default
  }

  // Validate date format
  if (date !== 'yesterday' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { success: false, error: 'Invalid date format. Use YYYY-MM-DD or "yesterday"' },
      { status: 400 }
    )
  }

  try {
    const result = await ingestDailyCompliance(date)
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[Compliance API] Ingest failed:', error)
    return NextResponse.json(
      { success: false, error: 'Compliance export failed' },
      { status: 500 }
    )
  }
}
