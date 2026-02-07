import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

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

// Active sessions store (in production, use Redis)
const activeSessions = new Map<string, {
  userId: string
  createdAt: number
  expiresAt: number
}>()

// Session TTL: 30 minutes
const SESSION_TTL_MS = 30 * 60 * 1000

// Cleanup expired sessions periodically
function cleanupExpiredSessions() {
  const now = Date.now()
  const sessionIds = Array.from(activeSessions.keys())
  for (const sessionId of sessionIds) {
    const session = activeSessions.get(sessionId)
    if (session && session.expiresAt < now) {
      activeSessions.delete(sessionId)
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredSessions, 5 * 60 * 1000)
}

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

    // Verify server configuration (but don't expose it!)
    const apiKey = process.env.INWORLD_API_KEY
    if (!apiKey) {
      console.error('[Agent Session] INWORLD_API_KEY not configured')
      return NextResponse.json(
        { error: 'Voice service not configured' },
        { status: 503 }
      )
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
      wsUrl: `${wsProtocol}://${host}/api/agent/ws?sessionId=${encodeURIComponent(sessionId)}`,
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
  } catch (error) {
    console.error('[Agent Session] Failed to create session:', error)
    return NextResponse.json(
      { error: 'Failed to create voice session' },
      { status: 500 }
    )
  }
}

// Validate session (used by WebSocket handler)
export function validateSession(sessionId: string): { valid: boolean; userId?: string } {
  const session = activeSessions.get(sessionId)

  if (!session) {
    return { valid: false }
  }

  if (session.expiresAt < Date.now()) {
    activeSessions.delete(sessionId)
    return { valid: false }
  }

  return { valid: true, userId: session.userId }
}

// Invalidate session (logout/disconnect)
export function invalidateSession(sessionId: string): void {
  activeSessions.delete(sessionId)
}
