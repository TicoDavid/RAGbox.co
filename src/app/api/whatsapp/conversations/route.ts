/**
 * WhatsApp Conversations API - RAGbox.co
 *
 * GET /api/whatsapp/conversations — List conversations for current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userId = (token.id as string) || token.email || ''
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unable to determine user identity' },
        { status: 401 }
      )
    }

    const conversations = await prisma.whatsAppConversation.findMany({
      where: { userId, status: { not: 'blocked' } },
      include: {
        contact: {
          select: {
            id: true,
            phoneNumber: true,
            displayName: true,
          },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      data: conversations,
    })
  } catch (error) {
    logger.error('[API] WhatsApp conversations error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}
