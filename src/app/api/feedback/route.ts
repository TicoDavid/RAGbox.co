/**
 * Feedback API — RAGbox.co
 *
 * POST /api/feedback — Submit feedback (any authenticated user)
 * GET  /api/feedback — List feedback (Partner/admin see all, users see own)
 *
 * Uses raw SQL because Prisma client can't regenerate on Windows (binary lock).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

const VALID_CATEGORIES = ['bug', 'feature', 'general']

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  let body: { category?: string; message?: string; screenshotUrl?: string; currentUrl?: string; browserInfo?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const category = body.category?.trim()
  const message = body.message?.trim()

  if (!category || !VALID_CATEGORIES.includes(category)) {
    return NextResponse.json(
      { success: false, error: `Category must be one of: ${VALID_CATEGORIES.join(', ')}` },
      { status: 400 }
    )
  }

  if (!message || message.length < 10) {
    return NextResponse.json(
      { success: false, error: 'Message must be at least 10 characters' },
      { status: 400 }
    )
  }

  if (message.length > 5000) {
    return NextResponse.json(
      { success: false, error: 'Message must be 5000 characters or fewer' },
      { status: 400 }
    )
  }

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{
      id: string; category: string; message: string; status: string; created_at: Date
    }>>(
      `INSERT INTO feedback_entries (id, user_id, user_email, category, message, screenshot_url, current_url, browser_info, status, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, 'new', NOW(), NOW())
       RETURNING id, category, message, status, created_at`,
      userId,
      (token.email as string) ?? null,
      category,
      message,
      body.screenshotUrl ?? null,
      body.currentUrl ?? null,
      body.browserInfo ?? null
    )

    const entry = rows[0]
    return NextResponse.json({
      success: true,
      data: {
        feedback: {
          id: entry.id,
          category: entry.category,
          message: entry.message,
          status: entry.status,
          createdAt: entry.created_at,
        },
      },
    }, { status: 201 })
  } catch (error) {
    logger.error('[Feedback POST] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to submit feedback' }, { status: 500 })
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const statusFilter = searchParams.get('status') || undefined
  const categoryFilter = searchParams.get('category') || undefined
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const offset = (page - 1) * limit

  // Admin check: is_admin flag on user record
  let isAdmin = false
  try {
    const users = await prisma.$queryRawUnsafe<Array<{ is_admin: boolean }>>(
      `SELECT is_admin FROM users WHERE id = $1 LIMIT 1`,
      userId
    )
    isAdmin = users.length > 0 && users[0].is_admin === true
  } catch {
    // Fall through — non-admin view
  }

  try {
    // Build WHERE clause dynamically
    const conditions: string[] = []
    const params: unknown[] = []
    let paramIdx = 1

    if (!isAdmin) {
      conditions.push(`user_id = $${paramIdx++}`)
      params.push(userId)
    }

    if (statusFilter && ['new', 'reviewed', 'resolved'].includes(statusFilter)) {
      conditions.push(`status = $${paramIdx++}`)
      params.push(statusFilter)
    }

    if (categoryFilter && VALID_CATEGORIES.includes(categoryFilter)) {
      conditions.push(`category = $${paramIdx++}`)
      params.push(categoryFilter)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const entries = await prisma.$queryRawUnsafe<Array<{
      id: string; user_id: string; user_email: string | null; category: string
      message: string; screenshot_url: string | null; status: string
      admin_response: string | null; created_at: Date; updated_at: Date
    }>>(
      `SELECT id, user_id, user_email, category, message, screenshot_url, status, admin_response, created_at, updated_at
       FROM feedback_entries ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      ...params, limit, offset
    )

    const countResult = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM feedback_entries ${whereClause}`,
      ...params
    )
    const total = Number(countResult[0]?.count ?? 0)

    return NextResponse.json({
      success: true,
      data: {
        entries: entries.map(e => ({
          id: e.id,
          userId: e.user_id,
          userEmail: e.user_email,
          category: e.category,
          message: e.message,
          screenshotUrl: e.screenshot_url,
          status: e.status,
          adminResponse: e.admin_response,
          createdAt: e.created_at,
          updatedAt: e.updated_at,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    })
  } catch (error) {
    logger.error('[Feedback GET] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to list feedback' }, { status: 500 })
  }
}
