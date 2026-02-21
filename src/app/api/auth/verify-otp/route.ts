/**
 * POST /api/auth/verify-otp
 *
 * Verifies the 6-digit OTP against Redis (primary) or in-memory store (fallback).
 * On success: encodes a NextAuth JWT, sets the session cookie, returns { success: true }.
 * On failure: returns 401.
 */

import { NextRequest, NextResponse } from 'next/server'
import { encode } from 'next-auth/jwt'
import { getRedis } from '@/lib/cache/redisClient'

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? ''
const IS_SECURE = (process.env.NEXTAUTH_URL ?? '').startsWith('https://')
const COOKIE_NAME = IS_SECURE
  ? '__Secure-next-auth.session-token'
  : 'next-auth.session-token'

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json()

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code are required' },
        { status: 400 },
      )
    }

    const normalizedEmail = email.toLowerCase().trim()
    const enteredCode = String(code).trim()

    // ── Verify against Redis (primary) ──────────────────────
    let verified = false
    const redis = getRedis()

    if (redis) {
      const storedCode = await redis.get(`otp:${normalizedEmail}`)
      if (storedCode && storedCode === enteredCode) {
        await redis.del(`otp:${normalizedEmail}`)
        verified = true
      }
    }

    // ── Fallback: in-memory store ───────────────────────────
    if (!verified) {
      const globalStore = (globalThis as Record<string, unknown>).otpStore as
        | Map<string, { code: string; expires: number }>
        | undefined

      if (globalStore) {
        const stored = globalStore.get(normalizedEmail)
        if (stored && stored.code === enteredCode && stored.expires > Date.now()) {
          globalStore.delete(normalizedEmail)
          verified = true
        }
      }
    }

    if (!verified) {
      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 401 },
      )
    }

    // ── Create NextAuth session ─────────────────────────────
    const token = await encode({
      token: {
        id: normalizedEmail,
        email: normalizedEmail,
        name: normalizedEmail.split('@')[0],
        provider: 'email-otp',
      },
      secret: NEXTAUTH_SECRET,
      maxAge: 30 * 24 * 60 * 60, // 30 days (matches authOptions)
    })

    const response = NextResponse.json({
      success: true,
      user: {
        id: normalizedEmail,
        email: normalizedEmail,
        name: normalizedEmail.split('@')[0],
      },
    })

    // Set the session cookie
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: IS_SECURE,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })

    return response
  } catch (err) {
    console.error('[verify-otp] Failed:', err)
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 },
    )
  }
}
