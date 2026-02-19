/**
 * Mercury Thread API - RAGbox.co
 *
 * GET   /api/mercury/thread — Get or create the user's active thread
 * POST  /api/mercury/thread — Create a new thread
 * PATCH /api/mercury/thread — Update thread title
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

const threadSelect = {
  id: true,
  title: true,
  createdAt: true,
  updatedAt: true,
} as const

async function authenticateUser(request: NextRequest) {
  const token = await getToken({ req: request })
  if (!token) return null
  const userId = (token.id as string) || token.email || ''
  return userId || null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await authenticateUser(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    // Get most recent thread or create one
    let thread = await prisma.mercuryThread.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: threadSelect,
    })

    if (!thread) {
      thread = await prisma.mercuryThread.create({
        data: { userId, title: 'Mercury Thread' },
        select: threadSelect,
      })
    }

    return NextResponse.json({ success: true, data: thread })
  } catch (error) {
    console.error('[Mercury Thread] Error:', error)
    // Return 200 with null thread — prevents console 500s and retry storms
    return NextResponse.json({ success: false, data: null })
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await authenticateUser(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const thread = await prisma.mercuryThread.create({
      data: { userId, title: 'New Chat' },
      select: threadSelect,
    })

    return NextResponse.json({ success: true, data: thread })
  } catch (error) {
    console.error('[Mercury Thread] POST error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create thread' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await authenticateUser(request)
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { threadId, title } = body as { threadId?: string; title?: string }

    if (!threadId || !title) {
      return NextResponse.json({ success: false, error: 'threadId and title are required' }, { status: 400 })
    }

    // Verify ownership
    const existing = await prisma.mercuryThread.findFirst({
      where: { id: threadId, userId },
      select: { id: true },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Thread not found' }, { status: 404 })
    }

    const updated = await prisma.mercuryThread.update({
      where: { id: threadId },
      data: { title: title.slice(0, 80) },
      select: threadSelect,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('[Mercury Thread] PATCH error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update thread' }, { status: 500 })
  }
}
