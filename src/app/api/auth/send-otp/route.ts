/**
 * POST /api/auth/send-otp
 *
 * Generates a 6-digit OTP, stores it in Redis (10-min TTL),
 * and sends it to the user's email via Resend.
 * Falls back to in-memory store when Redis is unavailable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getRedis } from '@/lib/cache/redisClient'
import { generateOTP } from '@/lib/auth'
import { sendOTP } from '@/lib/email/resend'

const OTP_TTL_SECONDS = 600 // 10 minutes

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
    const code = Math.floor(100000 + Math.random() * 900000).toString()

    // Store in Redis (primary) with 10-minute TTL
    const redis = getRedis()
    if (redis) {
      await redis.set(`otp:${normalizedEmail}`, code, 'EX', OTP_TTL_SECONDS)
    }

    // Also store in-memory (fallback for CredentialsProvider authorize)
    generateOTP(normalizedEmail)
    // Overwrite the in-memory code with the same one we stored in Redis
    // so both stores are consistent
    const globalStore = (globalThis as Record<string, unknown>).otpStore as
      | Map<string, { code: string; expires: number }>
      | undefined
    if (globalStore) {
      globalStore.set(normalizedEmail, {
        code,
        expires: Date.now() + OTP_TTL_SECONDS * 1000,
      })
    }

    // Send the OTP email via Resend
    await sendOTP(normalizedEmail, code)

    return NextResponse.json({
      success: true,
      message: 'OTP sent to email',
      // Expose code in dev for testing
      ...(process.env.NODE_ENV === 'development' && { otp: code }),
    })
  } catch (err) {
    console.error('[send-otp] Failed:', err)
    return NextResponse.json(
      { error: 'Failed to send OTP' },
      { status: 500 },
    )
  }
}
