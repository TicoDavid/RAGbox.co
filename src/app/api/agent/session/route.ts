import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { activeSessions, SESSION_TTL_MS } from './session-store'
import jwt from 'jsonwebtoken'

/**
 * Secure Agent Session Bootstrap
 *
 * Creates a session for the voice agent WITHOUT exposing any secrets.
 * The browser receives only:
 * - sessionId: unique identifier for this session
 * - wsUrl: WebSocket endpoint to connect to
 * - audio: client audio capture configuration
 *
 * All Inworld API communication happens server-side only.
 */

export async function POST() {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // BUG-041C: Check for VOICE_JWT_SECRET, NOT INWORLD_API_KEY.
    // This route runs on ragbox-app which only needs the JWT signing secret.
    // INWORLD_API_KEY lives on mercury-voice (separate Cloud Run service).
    // The old INWORLD_API_KEY guard was causing the route to return
    // "Voice features coming soon" even though voice IS configured.
    const voiceConfigured = process.env.VOICE_JWT_SECRET || process.env.INWORLD_API_KEY
    if (!voiceConfigured) {
      return NextResponse.json({
        available: false,
        message: 'Voice features coming soon. Text chat is fully available.',
        code: 'VOICE_NOT_CONFIGURED',
      }, { status: 200 })
    }

    // Generate secure session ID
    const sessionId = `sess_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`

    // Store session server-side
    const now = Date.now()
    activeSessions.set(sessionId, {
      userId: session.user.email,
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    })

    // Determine WebSocket URL based on environment
    const wsProtocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws'
    // BUG-041: Use MERCURY_VOICE_URL for the dedicated voice Cloud Run service.
    // Falls back to NEXT_PUBLIC_APP_URL for single-process deployments (dev).
    const host = (process.env.MERCURY_VOICE_URL || process.env.NEXT_PUBLIC_APP_URL)?.replace(/^https?:\/\//, '')
    if (!host) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_APP_URL not configured' },
        { status: 503 }
      )
    }

    // BUG-041: Sign a JWT with VOICE_JWT_SECRET for cross-service auth.
    // mercury-voice is a separate Cloud Run service that can't access
    // ragbox-app's in-memory session store or NextAuth cookies (different domain).
    // A shared JWT secret lets both services authenticate without shared state.
    const voiceJwtSecret = process.env.VOICE_JWT_SECRET
    let voiceToken: string | null = null
    if (voiceJwtSecret) {
      voiceToken = jwt.sign(
        { userId: session.user.email, role: 'User' },
        voiceJwtSecret,
        { expiresIn: '1h' }
      )
    }

    // Build WebSocket URL: prefer JWT token auth, fall back to sessionId
    const authParam = voiceToken
      ? `token=${encodeURIComponent(voiceToken)}`
      : `sessionId=${encodeURIComponent(sessionId)}`

    // Return ONLY safe, non-secret data
    return NextResponse.json({
      success: true,
      sessionId,
      // BUG-041: voiceToken for explicit cross-service auth
      ...(voiceToken ? { voiceToken } : {}),
      // WebSocket endpoint - all audio flows through here
      wsUrl: `${wsProtocol}://${host}/agent/ws?${authParam}`,
      // Audio configuration for client capture
      audio: {
        sampleRateHz: 16000,
        encoding: 'pcm_s16le',
        channels: 1,
        // Voice activity detection hints
        vadSilenceMs: 1500,
        vadThreshold: 0.5,
      },
      // Session metadata
      expiresIn: SESSION_TTL_MS,
    })
  } catch {
    return NextResponse.json(
      { error: 'Failed to create voice session' },
      { status: 500 }
    )
  }
}

// Session validation helpers available in session-store.ts:
// - validateSession(sessionId) - validates session and returns userId
// - invalidateSession(sessionId) - removes session on logout/disconnect
