/**
 * Feedback Detail API — RAGbox.co
 *
 * PATCH /api/feedback/[id] — Update status + admin response (Partner role only)
 *
 * Uses raw SQL because Prisma client can't regenerate on Windows (binary lock).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: RouteContext): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  // Admin check: is_admin flag on user record
  let isAdmin = false
  try {
    const users = await prisma.$queryRawUnsafe<Array<{ is_admin: boolean }>>(
      `SELECT is_admin FROM users WHERE id = $1 LIMIT 1`,
      userId
    )
    isAdmin = users.length > 0 && users[0].is_admin === true
  } catch {
    // Fall through
  }

  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 })
  }

  const { id } = await params

  let body: { status?: string; adminResponse?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const validStatuses = ['new', 'reviewed', 'resolved']
  if (body.status && !validStatuses.includes(body.status)) {
    return NextResponse.json(
      { success: false, error: `Status must be one of: ${validStatuses.join(', ')}` },
      { status: 400 }
    )
  }

  try {
    // Verify entry exists
    const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM feedback_entries WHERE id = $1 LIMIT 1`,
      id
    )

    if (existing.length === 0) {
      return NextResponse.json({ success: false, error: 'Feedback entry not found' }, { status: 404 })
    }

    // Build SET clause dynamically
    const setClauses: string[] = ['updated_at = NOW()']
    const params_list: unknown[] = []
    let paramIdx = 1

    if (body.status) {
      setClauses.push(`status = $${paramIdx++}`)
      params_list.push(body.status)
    }
    if (body.adminResponse !== undefined) {
      setClauses.push(`admin_response = $${paramIdx++}`)
      params_list.push(body.adminResponse)
    }

    if (setClauses.length === 1) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 })
    }

    const updated = await prisma.$queryRawUnsafe<Array<{
      id: string; category: string; message: string; status: string
      admin_response: string | null; created_at: Date; updated_at: Date
    }>>(
      `UPDATE feedback_entries SET ${setClauses.join(', ')}
       WHERE id = $${paramIdx}
       RETURNING id, category, message, status, admin_response, created_at, updated_at`,
      ...params_list, id
    )

    const entry = updated[0]
    return NextResponse.json({
      success: true,
      data: {
        feedback: {
          id: entry.id,
          category: entry.category,
          message: entry.message,
          status: entry.status,
          adminResponse: entry.admin_response,
          createdAt: entry.created_at,
          updatedAt: entry.updated_at,
        },
      },
    })
  } catch (error) {
    logger.error('[Feedback PATCH] Error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update feedback' }, { status: 500 })
  }
}
