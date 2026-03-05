/**
 * Twilio Call Status Webhook — EPIC-024
 *
 * POST /api/webhooks/twilio/status
 *
 * Receives call status callbacks (initiated, ringing, answered, completed, failed).
 * Logs to MercuryAction for audit trail.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import type { Prisma } from '@prisma/client'

const TWILIO_DEFAULT_USER_ID = process.env.TWILIO_DEFAULT_USER_ID || process.env.ROAM_DEFAULT_USER_ID || ''

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData()
  const params: Record<string, string> = {}
  formData.forEach((value, key) => { params[key] = String(value) })

  const callSid = params.CallSid || ''
  const callStatus = params.CallStatus || ''
  const from = params.From || ''
  const to = params.To || ''
  const direction = params.Direction || ''
  const duration = params.CallDuration || ''

  logger.info('[Twilio/Status] Call status update', { callSid, callStatus, from, to, direction, duration })

  // Persist status to audit log
  try {
    await prisma.mercuryAction.create({
      data: {
        userId: TWILIO_DEFAULT_USER_ID,
        actionType: `phone_call_${callStatus}`,
        status: 'completed',
        metadata: {
          channel: 'phone',
          callSid,
          callStatus,
          from,
          to,
          direction,
          duration: duration ? parseInt(duration, 10) : undefined,
        } as Prisma.InputJsonValue,
      },
    })
  } catch (err) {
    logger.error('[Twilio/Status] Audit write failed:', err)
  }

  // Twilio expects 200 OK
  return new NextResponse('<Response />', {
    headers: { 'Content-Type': 'text/xml' },
  })
}
