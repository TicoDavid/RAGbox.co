/**
 * Auth Log API - RAGbox.co
 *
 * POST /api/auth/_log — Receives auth events (login, logout, token refresh)
 * This is a fire-and-forget endpoint. Must never crash.
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    logger.info('[Auth Log]', { event: body.event || 'unknown', userId: body.userId || '' })
  } catch {
    // Silent — logging must never crash the app
  }
  return NextResponse.json({ ok: true })
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true })
}
