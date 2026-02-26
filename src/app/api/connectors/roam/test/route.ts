/**
 * ROAM Connector Test — POST /api/connectors/roam/test
 *
 * Validate ROAM API key without storing anything.
 * Calls GET groups.list with provided key.
 * Returns { valid: true, workspace, groupCount } or { valid: false, error }.
 *
 * EPIC-018 S01
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { listGroupsWithKey } from '@/lib/roam/roamClient'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

interface TestBody {
  apiKey?: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ valid: false, error: 'Authentication required' }, { status: 401 })
  }

  let body: TestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.apiKey?.trim()) {
    return NextResponse.json({ valid: false, error: 'apiKey is required' }, { status: 400 })
  }

  try {
    const groups = await listGroupsWithKey(body.apiKey.trim())
    return NextResponse.json({
      valid: true,
      workspace: 'ConnexUS Ai Inc',
      groupCount: groups.length,
    })
  } catch (error) {
    const status = (error as { status?: number }).status
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (status === 401 || status === 403) {
      return NextResponse.json({ valid: false, error: 'Invalid API key' })
    }

    logger.error('[ROAM Test] Credential validation failed:', message)
    return NextResponse.json({ valid: false, error: message })
  }
}
