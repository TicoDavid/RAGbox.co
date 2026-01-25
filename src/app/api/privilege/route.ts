/**
 * Privilege Mode API - RAGbox.co
 *
 * Manages user privilege mode state for attorney-client
 * and work product protection filtering.
 *
 * GET /api/privilege - Get current privilege state
 * POST /api/privilege - Set privilege state
 */

import { NextRequest, NextResponse } from 'next/server'
import { logPrivilegeModeChange } from '@/lib/audit'
import { cookies } from 'next/headers'

// In-memory store for privilege state (per session)
// TODO: Replace with database storage when Prisma is properly configured
const privilegeStore = new Map<
  string,
  {
    isPrivileged: boolean
    lastChanged: Date
    userId: string
  }
>()

// Cookie name for privilege session
const PRIVILEGE_COOKIE = 'ragbox_privilege_mode'

/**
 * Extract user ID from request
 * In production, this should verify the session token
 */
async function getUserId(request: NextRequest): Promise<string | null> {
  // Try to get from session cookie or auth header
  const sessionCookie = (await cookies()).get('session')
  if (sessionCookie?.value) {
    // In production: verify session token and extract user ID
    return sessionCookie.value
  }

  // Fallback to auth header
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    // In production: verify JWT and extract user ID
    return authHeader.slice(7)
  }

  // Development fallback: use IP-based session
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0] || 'anonymous'
  return `session_${ip}`
}

/**
 * Extract client IP for audit logging
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0] || 'unknown'
}

/**
 * GET /api/privilege
 *
 * Returns the current privilege mode state for the user.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check stored state
    const stored = privilegeStore.get(userId)

    // Also check cookie for persistence across server restarts
    const cookieStore = await cookies()
    const privilegeCookie = cookieStore.get(PRIVILEGE_COOKIE)
    const cookieValue = privilegeCookie?.value === 'true'

    const isPrivileged = stored?.isPrivileged ?? cookieValue ?? false
    const lastChanged = stored?.lastChanged ?? null

    return NextResponse.json({
      isPrivileged,
      lastChanged: lastChanged?.toISOString() ?? null,
      userId,
    })
  } catch (error) {
    console.error('Error fetching privilege state:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/privilege
 *
 * Updates the privilege mode state for the user.
 * Logs the change to the audit trail.
 *
 * Request body:
 * {
 *   "privileged": boolean
 * }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    let body: { privileged?: boolean }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Validate input
    if (typeof body.privileged !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request: privileged must be a boolean' },
        { status: 400 }
      )
    }

    const previousState = privilegeStore.get(userId)
    const wasPrivileged = previousState?.isPrivileged ?? false

    // Only log and update if state actually changed
    if (wasPrivileged !== body.privileged) {
      const ipAddress = getClientIP(request)

      // Log privilege change to audit trail
      try {
        await logPrivilegeModeChange(userId, body.privileged, ipAddress)
      } catch (auditError) {
        // Log error but don't fail the request
        console.error('Failed to log privilege change to audit:', auditError)
      }
    }

    // Update stored state
    const now = new Date()
    privilegeStore.set(userId, {
      isPrivileged: body.privileged,
      lastChanged: now,
      userId,
    })

    // Set cookie for persistence
    const cookieStore = await cookies()
    cookieStore.set(PRIVILEGE_COOKIE, body.privileged.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    })

    return NextResponse.json({
      isPrivileged: body.privileged,
      lastChanged: now.toISOString(),
      userId,
      message: body.privileged ? 'Privilege mode enabled' : 'Privilege mode disabled',
    })
  } catch (error) {
    console.error('Error updating privilege state:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * OPTIONS /api/privilege
 *
 * CORS preflight handler
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
