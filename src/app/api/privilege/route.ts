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
import prisma from '@/lib/prisma'

// Cookie name for privilege session (fallback for unauthenticated users)
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

    // Try to get from database first
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        privilegeModeEnabled: true,
        privilegeModeChangedAt: true,
      },
    })

    if (user) {
      return NextResponse.json({
        isPrivileged: user.privilegeModeEnabled,
        lastChanged: user.privilegeModeChangedAt?.toISOString() ?? null,
        userId,
      })
    }

    // Fallback to cookie for unauthenticated users or demo mode
    const cookieStore = await cookies()
    const privilegeCookie = cookieStore.get(PRIVILEGE_COOKIE)
    const isPrivileged = privilegeCookie?.value === 'true'

    return NextResponse.json({
      isPrivileged,
      lastChanged: null,
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

    const now = new Date()
    const ipAddress = getClientIP(request)

    // Try to update in database
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { privilegeModeEnabled: true },
    })

    if (existingUser) {
      const wasPrivileged = existingUser.privilegeModeEnabled

      // Only log and update if state actually changed
      if (wasPrivileged !== body.privileged) {
        // Update user in database
        await prisma.user.update({
          where: { id: userId },
          data: {
            privilegeModeEnabled: body.privileged,
            privilegeModeChangedAt: now,
          },
        })

        // Log privilege change to audit trail
        try {
          await logPrivilegeModeChange(userId, body.privileged, ipAddress)
        } catch (auditError) {
          console.error('Failed to log privilege change to audit:', auditError)
        }
      }

      return NextResponse.json({
        isPrivileged: body.privileged,
        lastChanged: now.toISOString(),
        userId,
        message: body.privileged ? 'Privilege mode enabled' : 'Privilege mode disabled',
      })
    }

    // Fallback to cookie for unauthenticated users or demo mode
    const cookieStore = await cookies()
    cookieStore.set(PRIVILEGE_COOKIE, body.privileged.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    })

    // Log even for demo users
    try {
      await logPrivilegeModeChange(userId, body.privileged, ipAddress)
    } catch (auditError) {
      console.error('Failed to log privilege change to audit:', auditError)
    }

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
