/**
 * Document Privilege API - RAGbox.co
 *
 * Manages per-document privilege tagging for attorney-client
 * and work product protection.
 *
 * PATCH /api/documents/[id]/privilege - Toggle document privilege
 * GET /api/documents/[id]/privilege - Get document privilege status
 */

import { NextRequest, NextResponse } from 'next/server'
import { logDocumentPrivilegeChange } from '@/lib/audit'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'

// Cookie name for privilege mode check
const PRIVILEGE_COOKIE = 'ragbox_privilege_mode'

/**
 * Extract user ID from request
 */
async function getUserId(request: NextRequest): Promise<string | null> {
  const sessionCookie = (await cookies()).get('session')
  if (sessionCookie?.value) {
    return sessionCookie.value
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0] || 'anonymous'
  return `session_${ip}`
}

/**
 * Check if user is currently in privilege mode
 */
async function isInPrivilegeMode(): Promise<boolean> {
  const cookieStore = await cookies()
  const privilegeCookie = cookieStore.get(PRIVILEGE_COOKIE)
  return privilegeCookie?.value === 'true'
}

/**
 * Extract client IP for audit logging
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0] || 'unknown'
}

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/documents/[id]/privilege
 *
 * Returns the privilege status of a specific document.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id: documentId } = await params

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
    }

    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get privilege status from database
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { isPrivileged: true, updatedAt: true },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    return NextResponse.json({
      documentId,
      isPrivileged: document.isPrivileged,
      lastChanged: document.updatedAt?.toISOString() ?? null,
    })
  } catch (error) {
    console.error('Error fetching document privilege:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/documents/[id]/privilege
 *
 * Updates the privilege status of a specific document.
 *
 * Request body:
 * {
 *   "privileged": boolean,
 *   "filename": string (optional, for audit logging)
 * }
 *
 * Safety rules:
 * - Cannot unmark privilege when in privileged mode (prevents accidental exposure)
 * - Requires confirmation token for unmarking
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id: documentId } = await params

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
    }

    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    let body: { privileged?: boolean; filename?: string; confirmUnmark?: boolean }
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

    const existingDoc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { isPrivileged: true },
    })

    if (!existingDoc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const currentPrivilege = existingDoc.isPrivileged
    const inPrivilegeMode = await isInPrivilegeMode()

    // Safety check: Cannot unmark privilege when in privileged mode
    if (currentPrivilege && !body.privileged && inPrivilegeMode) {
      return NextResponse.json(
        {
          error: 'Cannot remove privilege protection while in Privileged Mode',
          code: 'PRIVILEGE_MODE_SAFETY',
          message:
            'For security, you must exit Privileged Mode before removing privilege protection from documents.',
        },
        { status: 403 }
      )
    }

    // Safety check: Require explicit confirmation for unmarking privilege
    if (currentPrivilege && !body.privileged && !body.confirmUnmark) {
      return NextResponse.json(
        {
          error: 'Confirmation required to remove privilege protection',
          code: 'CONFIRM_UNMARK_REQUIRED',
          message:
            'Removing privilege protection will make this document visible in normal mode. Please confirm this action.',
          requiresConfirmation: true,
        },
        { status: 400 }
      )
    }

    const ipAddress = getClientIP(request)
    const filename = body.filename || `document_${documentId}`

    // Log privilege change to audit trail
    try {
      await logDocumentPrivilegeChange(userId, documentId, filename, body.privileged, ipAddress)
    } catch (auditError) {
      console.error('Failed to log privilege change to audit:', auditError)
    }

    // Persist privilege state to database
    const updated = await prisma.document.update({
      where: { id: documentId },
      data: { isPrivileged: body.privileged },
      select: { isPrivileged: true, updatedAt: true },
    })

    return NextResponse.json({
      documentId,
      isPrivileged: updated.isPrivileged,
      lastChanged: updated.updatedAt.toISOString(),
      changedBy: userId,
      message: body.privileged
        ? 'Document marked as privileged'
        : 'Privilege protection removed from document',
    })
  } catch (error) {
    console.error('Error updating document privilege:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * OPTIONS /api/documents/[id]/privilege
 *
 * CORS preflight handler
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
