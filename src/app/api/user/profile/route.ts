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
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
    },
  })

  if (!user) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    data: {
      displayName: user.name,
      email: user.email,
      avatarUrl: user.image,
      role: user.role,
    },
  })
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
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
