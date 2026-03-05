/**
 * User Profile API
 *
 * GET  /api/user/profile — Return current user profile
 * PUT  /api/user/profile — Update display name (avatar upload is P2)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''

  // Use raw SQL — isAdmin field may not be in generated Prisma client yet
  const users = await prisma.$queryRawUnsafe<Array<{
    id: string; name: string | null; email: string; image: string | null; role: string; is_admin: boolean; subscription_tier: string | null
  }>>(
    `SELECT id, name, email, image, role, is_admin, subscription_tier FROM users WHERE id = $1 LIMIT 1`,
    userId
  )

  if (users.length === 0) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  }

  const user = users[0]

  return NextResponse.json({
    success: true,
    data: {
      displayName: user.name,
      email: user.email,
      avatarUrl: user.image,
      role: user.role,
      isAdmin: user.is_admin === true,
      subscriptionTier: user.subscription_tier || null,
    },
  })
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''

  let body: { displayName?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.displayName || typeof body.displayName !== 'string') {
    return NextResponse.json({ success: false, error: 'displayName is required' }, { status: 400 })
  }

  const trimmed = body.displayName.trim()

  if (trimmed.length === 0) {
    return NextResponse.json({ success: false, error: 'displayName cannot be empty' }, { status: 400 })
  }

  if (trimmed.length > 100) {
    return NextResponse.json({ success: false, error: 'displayName must be 100 characters or less' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { name: trimmed },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
    },
  })

  return NextResponse.json({
    success: true,
    data: {
      displayName: updated.name,
      email: updated.email,
      avatarUrl: updated.image,
      role: updated.role,
    },
  })
}
