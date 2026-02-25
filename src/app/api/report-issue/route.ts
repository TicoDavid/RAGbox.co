/**
 * Report Issue API — Persist to DB + optional Go backend forwarding
 *
 * POST /api/report-issue — Submit a bug report or feature request
 *
 * Rate limited: max 5 submissions per hour per user.
 * Always persists to feedback_reports table. Also forwards to Go
 * backend when BACKEND_URL is configured.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

// Simple in-memory rate limit (per-process; resets on deploy)
const rateLimitMap = new Map<string, number[]>()
const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const timestamps = (rateLimitMap.get(userId) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW,
  )
  if (timestamps.length >= RATE_LIMIT_MAX) return false
  timestamps.push(now)
  rateLimitMap.set(userId, timestamps)
  return true
}

const VALID_TYPES = ['bug', 'feature', 'question'] as const

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''

  if (!checkRateLimit(userId)) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Maximum 5 reports per hour.' },
      { status: 429 },
    )
  }

  let body: { type?: string; description?: string; currentUrl?: string; browserInfo?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.type || !VALID_TYPES.includes(body.type as typeof VALID_TYPES[number])) {
    return NextResponse.json(
      { success: false, error: `type must be one of: ${VALID_TYPES.join(', ')}` },
      { status: 400 },
    )
  }

  if (!body.description || typeof body.description !== 'string') {
    return NextResponse.json(
      { success: false, error: 'description is required' },
      { status: 400 },
    )
  }

  const trimmed = body.description.trim()
  if (trimmed.length < 10) {
    return NextResponse.json(
      { success: false, error: 'description must be at least 10 characters' },
      { status: 400 },
    )
  }

  // Persist to database
  const userEmail = (token.email as string) || null
  try {
    await prisma.feedbackReport.create({
      data: {
        userId,
        userEmail,
        type: body.type,
        description: trimmed,
        currentUrl: body.currentUrl || null,
        browserInfo: body.browserInfo || null,
      },
    })
  } catch (dbErr) {
    logger.error('Failed to persist feedback report:', dbErr)
    // Continue — don't block the user if DB write fails
  }

  // Also forward to Go backend if configured
  const backendUrl = process.env.BACKEND_URL
  if (backendUrl) {
    try {
      const backendRes = await fetch(`${backendUrl}/api/report-issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          type: body.type,
          description: trimmed,
          currentUrl: body.currentUrl || null,
        }),
      })
      if (backendRes.ok) {
        const result = await backendRes.json()
        return NextResponse.json({
          success: true,
          issueUrl: result.issueUrl || null,
        })
      }
    } catch (err) {
      logger.error('Go backend report-issue forwarding failed:', err)
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Report submitted successfully.',
  })
}
