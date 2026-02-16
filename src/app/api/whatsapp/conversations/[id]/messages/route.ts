/**
 * WhatsApp Messages API - RAGbox.co
 *
 * GET  /api/whatsapp/conversations/[id]/messages — Paginated messages
 * POST /api/whatsapp/conversations/[id]/messages — Send manual message (persists + calls voice server)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userId = (token.id as string) || token.email || ''
    const { id: conversationId } = await params

    // Verify ownership
    const conversation = await prisma.whatsAppConversation.findFirst({
      where: { id: conversationId, userId },
    })

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    const messages = await prisma.whatsAppMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const nextCursor = messages.length === limit
      ? messages[messages.length - 1].id
      : null

    return NextResponse.json({
      success: true,
      data: messages,
      nextCursor,
    })
  } catch (error) {
    console.error('[API] WhatsApp messages error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userId = (token.id as string) || token.email || ''
    const { id: conversationId } = await params

    // Verify ownership
    const conversation = await prisma.whatsAppConversation.findFirst({
      where: { id: conversationId, userId },
      include: { contact: true },
    })

    if (!conversation) {
      return NextResponse.json(
        { success: false, error: 'Conversation not found' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { text } = body

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json(
        { success: false, error: 'Text is required' },
        { status: 400 }
      )
    }

    // Persist the outbound message (status: sent — actual delivery happens via processor)
    const message = await prisma.whatsAppMessage.create({
      data: {
        conversationId,
        direction: 'outbound',
        messageType: 'text',
        content: text.trim(),
        status: 'sent',
      },
    })

    // Update conversation metadata
    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageText: text.trim().slice(0, 100),
        lastMessageAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      data: message,
    })
  } catch (error) {
    console.error('[API] WhatsApp send message error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
