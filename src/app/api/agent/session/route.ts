import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { activeSessions, SESSION_TTL_MS } from './session-store'

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

    // Check if voice service is configured
    const apiKey = process.env.INWORLD_API_KEY
    if (!apiKey) {
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
    const host = process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'localhost:3000'

    // Return ONLY safe, non-secret data
    return NextResponse.json({
      success: true,
      sessionId,
      // WebSocket endpoint - all audio flows through here
      wsUrl: `${wsProtocol}://${host}/agent/ws?sessionId=${encodeURIComponent(sessionId)}`,
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
