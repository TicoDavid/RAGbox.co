/**
 * Mercury SMS Action — Vonage Messages API
 *
 * POST /api/mercury/actions/send-sms
 * Body: { to: string, body: string }
 *
 * Sends SMS via Vonage Messages API (same credentials as WhatsApp).
 * Logs to MercuryAction for audit trail.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

const VONAGE_API_KEY = process.env.VONAGE_API_KEY || ''
const VONAGE_API_SECRET = process.env.VONAGE_API_SECRET || ''
const VONAGE_SMS_FROM = process.env.VONAGE_SMS_FROM_NUMBER || process.env.VONAGE_WHATSAPP_NUMBER || '14157386102'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const userId = (token.id as string) || token.email || ''
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
    }

    const body = await request.json()
    const { to, body: smsBody } = body

    if (!to || !smsBody) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: to, body' },
        { status: 400 }
      )
    }

    // Normalize phone number to E.164
    const normalizedTo = normalizePhone(to)
    if (!normalizedTo) {
      return NextResponse.json(
        { success: false, error: 'Invalid phone number. Use E.164 format (e.g. +15551234567).' },
        { status: 400 }
      )
    }

    if (!VONAGE_API_KEY || !VONAGE_API_SECRET) {
      await logMercuryAction(userId, 'sms', normalizedTo, undefined, smsBody, 'failed', { error: 'Vonage not configured' })
      return NextResponse.json(
        { success: false, error: 'SMS service not configured. Contact your administrator.' },
        { status: 503 }
      )
    }

    // Send via Vonage Messages API
    const auth = Buffer.from(`${VONAGE_API_KEY}:${VONAGE_API_SECRET}`).toString('base64')
    const vonageRes = await fetch('https://api.nexmo.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`,
      },
      body: JSON.stringify({
        message_type: 'text',
        text: smsBody,
        to: normalizedTo.replace('+', ''),
        from: VONAGE_SMS_FROM,
        channel: 'sms',
      }),
    })

    if (!vonageRes.ok) {
      const errBody = await vonageRes.text()
      console.error('[Mercury SMS] Vonage error:', vonageRes.status, errBody)

      await logMercuryAction(userId, 'sms', normalizedTo, undefined, smsBody, 'failed', {
        error: `Vonage ${vonageRes.status}`,
        detail: errBody,
      })

      return NextResponse.json(
        { success: false, error: `SMS delivery failed: ${vonageRes.status}` },
        { status: 502 }
      )
    }

    const data = await vonageRes.json()
    const messageUuid = data.message_uuid || ''

    // Log success
    await logMercuryAction(userId, 'sms', normalizedTo, undefined, smsBody, 'completed', { messageUuid })

    // Write to unified thread
    await writeMercuryThread(userId, normalizedTo, smsBody)

    return NextResponse.json({
      success: true,
      data: { messageUuid },
    })
  } catch (error) {
    console.error('[Mercury SMS] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send SMS' },
      { status: 500 }
    )
  }
}

// =============================================================================

function normalizePhone(input: string): string | null {
  // Strip everything except digits and leading +
  const cleaned = input.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+') && cleaned.length >= 8) return cleaned
  if (/^\d{10}$/.test(cleaned)) return `+1${cleaned}` // US 10-digit
  if (/^1\d{10}$/.test(cleaned)) return `+${cleaned}` // US 11-digit with 1
  if (cleaned.length >= 7) return `+${cleaned}`
  return null
}

async function logMercuryAction(
  userId: string,
  actionType: string,
  recipient: string,
  subject: string | undefined,
  body: string,
  status: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.mercuryAction.create({
      data: {
        userId,
        actionType,
        recipient,
        subject: subject || null,
        body,
        status,
        metadata: metadata as Record<string, string>,
      },
    })
  } catch (error) {
    console.error('[Mercury SMS] Action log failed:', error)
  }
}

async function writeMercuryThread(userId: string, to: string, smsBody: string): Promise<void> {
  try {
    let thread = await prisma.mercuryThread.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    })
    if (!thread) {
      thread = await prisma.mercuryThread.create({
        data: { userId, title: 'Mercury Thread' },
        select: { id: true },
      })
    }

    await prisma.mercuryThreadMessage.create({
      data: {
        threadId: thread.id,
        role: 'assistant',
        channel: 'dashboard',
        content: `SMS sent to ${to}: "${smsBody.slice(0, 100)}"`,
      },
    })
  } catch (error) {
    console.error('[Mercury SMS] Thread write failed:', error)
  }
}
