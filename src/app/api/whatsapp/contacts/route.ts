/**
 * WhatsApp Contacts API - RAGbox.co
 *
 * GET  /api/whatsapp/contacts — List contacts for current user
 * POST /api/whatsapp/contacts — Add a new contact
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

/** E.164 phone number format */
const E164_REGEX = /^\+[1-9]\d{6,14}$/

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

    const contacts = await prisma.whatsAppContact.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: contacts })
  } catch (error) {
    logger.error('[API] WhatsApp contacts error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch contacts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userId = (token.id as string) || token.email || ''
    const body = await request.json()
    const { phoneNumber, displayName } = body

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Phone number is required' },
        { status: 400 }
      )
    }

    const normalized = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`

    if (!E164_REGEX.test(normalized)) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number format. Use E.164 (e.g., +14155552671)' },
        { status: 400 }
      )
    }

    const contact = await prisma.whatsAppContact.upsert({
      where: {
        userId_phoneNumber: {
          userId,
          phoneNumber: normalized,
        },
      },
      update: {
        displayName: displayName || undefined,
      },
      create: {
        userId,
        phoneNumber: normalized,
        displayName: displayName || null,
      },
    })

    return NextResponse.json({ success: true, data: contact })
  } catch (error) {
    logger.error('[API] WhatsApp add contact error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add contact' },
      { status: 500 }
    )
  }
}
