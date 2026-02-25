/**
 * POST /api/auth/send-otp
 *
 * Generates a 6-digit OTP via generateOTP() (Redis primary, in-memory fallback),
 * and sends it via the Gmail API. No fallback — if Gmail fails, return 500.
 *
 * EPIC-016 P06: Simplified — generateOTP() now handles both Redis + in-memory storage.
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateOTP } from '@/lib/auth'
import { sendViaGmail } from '@/lib/email/gmail'
import { logger } from '@/lib/logger'

/** Build the branded OTP email HTML. */
function otpEmailHtml(code: string): string {
  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
      <h2 style="color: #0A192F; margin-bottom: 8px;">Your verification code</h2>
      <p style="color: #475569; font-size: 14px; margin-bottom: 24px;">
        Enter this code to verify your identity:
      </p>
      <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0A192F;">${code}</span>
      </div>
      <p style="color: #94A3B8; font-size: 12px;">
        This code expires in 10 minutes. If you didn't request this, ignore this email.
      </p>
    </div>
  `
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email required' },
        { status: 400 },
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Generate OTP and store in Redis (primary) + in-memory (fallback)
    const code = await generateOTP(normalizedEmail)

    // Send OTP via Gmail API — no fallback
    const subject = `${code} is your RAGböx verification code`
    await sendViaGmail(normalizedEmail, subject, otpEmailHtml(code))

    return NextResponse.json({
      success: true,
      message: 'OTP sent to email',
      // Expose code in dev for testing
      ...(process.env.NODE_ENV === 'development' && { otp: code }),
    })
  } catch (err) {
    logger.error('[send-otp] Gmail send failed:', err)
    return NextResponse.json(
      { error: 'Failed to send OTP' },
      { status: 500 },
    )
  }
}
