/**
 * Agent Session Store
 *
 * Manages active voice agent sessions. Separated from route.ts to allow
 * external imports without violating Next.js API route export constraints.
 */

// Active sessions store (in production, use Redis)
export const activeSessions = new Map<string, {
  userId: string
  createdAt: number
  expiresAt: number
}>()

// Session TTL: 30 minutes
export const SESSION_TTL_MS = 30 * 60 * 1000

// Cleanup expired sessions periodically
export function cleanupExpiredSessions() {
  const now = Date.now()
  const sessionIds = Array.from(activeSessions.keys())
  for (const sessionId of sessionIds) {
    const session = activeSessions.get(sessionId)
    if (session && session.expiresAt < now) {
      activeSessions.delete(sessionId)
    }
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

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupExpiredSessions, 5 * 60 * 1000)
}
