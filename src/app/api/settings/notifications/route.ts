/**
 * Notification Preferences API
 *
 * GET  /api/settings/notifications — Return current preferences (or defaults)
 * PUT  /api/settings/notifications — Update notification preferences
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

const VALID_KEYS = ['email', 'push', 'audit'] as const

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''

  const settings = await prisma.notificationSettings.findUnique({
    where: { userId },
    select: { email: true, push: true, audit: true },
  })

  return NextResponse.json({
    success: true,
    data: settings || { email: true, push: false, audit: true },
  })
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate: only accept known boolean fields
  const updates: Record<string, boolean> = {}
  for (const key of VALID_KEYS) {
    if (key in body) {
      if (typeof body[key] !== 'boolean') {
        return NextResponse.json(
          { success: false, error: `${key} must be a boolean` },
          { status: 400 },
        )
      }
      updates[key] = body[key] as boolean
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 })
  }

  const settings = await prisma.notificationSettings.upsert({
    where: { userId },
    create: {
      userId,
      email: updates.email ?? true,
      push: updates.push ?? false,
      audit: updates.audit ?? true,
    },
    update: updates,
    select: { email: true, push: true, audit: true },
  })

  return NextResponse.json({ success: true, data: settings })
}
