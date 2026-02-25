/**
 * Integration Test Connection API - RAGbox.co
 *
 * POST /api/settings/integrations/test — Send a test message via Vonage
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    const userId = (token.id as string) || token.email || ''
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unable to determine user identity' },
        { status: 401 },
      )
    }

    const body = await request.json()
    const phoneNumber = body.phoneNumber as string

    if (!phoneNumber || !/^\+?\d{10,15}$/.test(phoneNumber.replace(/\s/g, ''))) {
      return NextResponse.json(
        { success: false, error: 'Valid phone number in E.164 format is required' },
        { status: 400 },
      )
    }

    // Get user's integration settings
    const settings = await prisma.integrationSettings.findUnique({
      where: { userId },
    })

    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Integration settings not configured' },
        { status: 400 },
      )
    }

    // Use saved credentials or fall back to env vars
    const apiKey = settings.vonageApiKey || process.env.VONAGE_API_KEY || ''
    const apiSecret = settings.vonageApiSecret || process.env.VONAGE_API_SECRET || ''
    const whatsappNumber = settings.vonageWhatsAppNumber || process.env.VONAGE_WHATSAPP_NUMBER || '14157386102'

    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { success: false, error: 'Vonage API credentials not configured' },
        { status: 400 },
      )
    }

    // Send test message via Vonage sandbox
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
    const cleanPhone = phoneNumber.replace('+', '')

    const response = await fetch('https://messages-sandbox.nexmo.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        message_type: 'text',
        text: 'RAGbox Mercury test message. Your WhatsApp integration is working correctly.',
        to: cleanPhone,
        from: whatsappNumber,
        channel: 'whatsapp',
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      logger.error('[API] Vonage test message failed:', response.status, errorBody)
      return NextResponse.json(
        { success: false, error: `Vonage API error: ${response.status}` },
        { status: 502 },
      )
    }

    const data = await response.json()
    return NextResponse.json({
      success: true,
      data: { messageId: data.message_uuid },
    })
  } catch (error) {
    logger.error('[API] Integration test error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send test message' },
      { status: 500 },
    )
  }
}
