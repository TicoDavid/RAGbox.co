/**
 * WhatsApp Messages API - RAGbox.co
 *
 * GET  /api/whatsapp/conversations/[id]/messages — Paginated messages
 * POST /api/whatsapp/conversations/[id]/messages — Send manual message (persists + calls voice server)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

const VONAGE_API_KEY = process.env.VONAGE_API_KEY || ''
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET || ''
const VONAGE_WHATSAPP_NUMBER = process.env.VONAGE_WHATSAPP_NUMBER || '14157386102'

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

    // Send via Vonage
    const phoneNumber = conversation.contact?.phoneNumber
    if (!phoneNumber) {
      return NextResponse.json(
        { success: false, error: 'Contact has no phone number' },
        { status: 400 }
      )
    }

    const sendResult = await sendVonageText(phoneNumber, text.trim())

    // Persist the outbound message
    const message = await prisma.whatsAppMessage.create({
      data: {
        conversationId,
        externalMessageId: sendResult.externalMessageId || null,
        direction: 'outbound',
        messageType: 'text',
        content: text.trim(),
        status: sendResult.success ? 'sent' : 'failed',
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

    if (!sendResult.success) {
      return NextResponse.json(
        { success: false, error: sendResult.error || 'Failed to send via Vonage', data: message },
        { status: 502 }
      )
    }

    return NextResponse.json({ success: true, data: message })
  } catch (error) {
    console.error('[API] WhatsApp send message error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send message' },
      { status: 500 }
    )
  }
}

// =============================================================================
// VONAGE SEND (inline — server/ excluded from Next.js TS compilation)
// =============================================================================

async function sendVonageText(
  to: string,
  text: string,
): Promise<{ externalMessageId: string; success: boolean; error?: string }> {
  if (!VONAGE_API_KEY || !VONAGE_API_SECRET) {
    console.warn('[WhatsApp] Vonage credentials not configured — skipping send')
    return { externalMessageId: '', success: false, error: 'Vonage not configured' }
  }

  try {
    const auth = Buffer.from(`${VONAGE_API_KEY}:${VONAGE_API_SECRET}`).toString('base64')
    const response = await fetch('https://messages-sandbox.nexmo.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        message_type: 'text',
        text,
        to: to.replace('+', ''),
        from: VONAGE_WHATSAPP_NUMBER,
        channel: 'whatsapp',
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[WhatsApp] Vonage send failed:', response.status, errorBody)
      return { externalMessageId: '', success: false, error: `Vonage ${response.status}` }
    }

    const data = await response.json()
    return { externalMessageId: data.message_uuid || '', success: true }
  } catch (error) {
    console.error('[WhatsApp] Vonage send error:', error)
    return {
      externalMessageId: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
