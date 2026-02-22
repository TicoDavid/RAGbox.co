/**
 * DELETE /api/v1/sessions — revoke all sessions except current
 *
 * JWT-only auth (no DB session table), so revocation works via Redis:
 * 1. Store revocation timestamp in Redis for the user
 * 2. Re-issue a fresh JWT cookie (new iat > revokedAt) so current session survives
 * 3. The jwt callback in auth.ts rejects tokens with iat < revokedAt
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { encode } from 'next-auth/jwt'
import { getRedis } from '@/lib/cache/redisClient'

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET ?? ''
const IS_SECURE = (process.env.NEXTAUTH_URL ?? '').startsWith('https://')
const COOKIE_NAME = IS_SECURE
  ? '__Secure-next-auth.session-token'
  : 'next-auth.session-token'

const SESSION_MAX_AGE = 30 * 24 * 60 * 60 // 30 days (matches authOptions)

export async function DELETE(request: NextRequest) {
  try {
    const token = await getToken({ req: request, secret: NEXTAUTH_SECRET })

    if (!token?.id && !token?.email) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 },
      )
    }

    const userId = (token.id as string) || (token.email as string)
    const redis = getRedis()

    if (!redis) {
      return NextResponse.json(
        { error: 'Session revocation unavailable (cache offline)' },
        { status: 503 },
      )
    }

    // Store revocation timestamp — any JWT with iat before this is invalid
    const revokedAt = Math.floor(Date.now() / 1000)
    await redis.set(
      `session:revoked:${userId}`,
      revokedAt.toString(),
      'EX',
      SESSION_MAX_AGE, // TTL matches session maxAge — no need to persist longer
    )

    // Re-issue a fresh JWT for the CURRENT session (new iat > revokedAt)
    const freshToken = await encode({
      token: {
        id: token.id,
        email: token.email,
        name: token.name,
        provider: token.provider,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
      },
      secret: NEXTAUTH_SECRET,
      maxAge: SESSION_MAX_AGE,
    })

    const response = NextResponse.json({
      success: true,
      revoked: true,
    })

    // Replace session cookie with fresh token
    response.cookies.set(COOKIE_NAME, freshToken, {
      httpOnly: true,
      secure: IS_SECURE,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    })

    return response
  } catch (err) {
    console.error('[sessions/revoke] Failed:', err)
    return NextResponse.json(
      { error: 'Failed to revoke sessions' },
      { status: 500 },
    )
  }
}
