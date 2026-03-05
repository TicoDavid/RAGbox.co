/**
 * Twilio Inbound Voice Webhook — EPIC-024
 *
 * POST /api/webhooks/twilio/voice
 *
 * When someone calls a Twilio number, this handler answers and bridges
 * the phone audio to the mercury-voice WebSocket pipeline via Twilio
 * Media Streams. Mercury listens (STT), queries RAG, and speaks (TTS)
 * back to the caller.
 *
 * Flow: Phone → Twilio → TwiML <Connect><Stream> → mercury-voice /agent/ws
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { createHmac, timingSafeEqual } from 'crypto'

const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || ''
const VOICE_WS_URL = process.env.NEXT_PUBLIC_VOICE_WS_URL || 'wss://mercury-voice-100739220279.us-east4.run.app/agent/ws'
const TWILIO_DEFAULT_USER_ID = process.env.TWILIO_DEFAULT_USER_ID || process.env.ROAM_DEFAULT_USER_ID || ''

/**
 * Validate Twilio request signature (X-Twilio-Signature header).
 * Prevents spoofed webhook calls.
 */
function validateTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!TWILIO_AUTH_TOKEN || !signature) return false

  // Build data string: URL + sorted params concatenated
  const data = url + Object.keys(params).sort().reduce((acc, key) => acc + key + params[key], '')
  const expected = createHmac('sha1', TWILIO_AUTH_TOKEN).update(data).digest('base64')

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData()
  const params: Record<string, string> = {}
  formData.forEach((value, key) => { params[key] = String(value) })

  // Validate Twilio signature in production
  if (TWILIO_AUTH_TOKEN) {
    const signature = request.headers.get('x-twilio-signature')
    const url = request.url
    if (!validateTwilioSignature(signature, url, params)) {
      logger.warn('[Twilio/Voice] Invalid signature — rejecting')
      return new NextResponse('<Response><Say>Unauthorized</Say></Response>', {
        status: 403,
        headers: { 'Content-Type': 'text/xml' },
      })
    }
  }

  const callSid = params.CallSid || ''
  const from = params.From || ''
  const to = params.To || ''

  logger.info('[Twilio/Voice] Inbound call', { callSid, from, to })

  // Build WebSocket URL with auth params for mercury-voice
  const wsUrl = new URL(VOICE_WS_URL)
  wsUrl.searchParams.set('userId', TWILIO_DEFAULT_USER_ID)
  wsUrl.searchParams.set('channel', 'phone')
  wsUrl.searchParams.set('callSid', callSid)
  wsUrl.searchParams.set('callerNumber', from)

  // Respond with TwiML: answer + connect media stream to mercury-voice
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl.toString()}" />
  </Connect>
</Response>`

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  })
}
