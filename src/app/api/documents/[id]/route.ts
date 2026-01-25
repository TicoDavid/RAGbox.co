/**
 * Document API - RAGbox.co
 *
 * GET /api/documents/[id] - Get a specific document
 * PATCH /api/documents/[id] - Update document metadata
 * DELETE /api/documents/[id] - Delete a document
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDocumentStore, type Document } from '@/lib/documents/store'
import { logDocumentDelete } from '@/lib/audit'

interface RouteParams {
  params: Promise<{ id: string }>
}

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

  // Demo fallback
  return 'demo_user'
}

/**
 * Extract client IP for audit logging
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0] || 'unknown'
}

/**
 * GET /api/documents/[id]
 *
 * Returns a specific document by ID.
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

    const store = getDocumentStore()
    const document = store.get(documentId)

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify ownership
    if (document.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/documents/[id]
 *
 * Updates document metadata.
 *
 * Request body:
 * {
 *   "name"?: string,
 *   "status"?: 'pending' | 'processing' | 'ready' | 'error',
 *   "chunkCount"?: number,
 *   "metadata"?: Record<string, unknown>
 * }
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

    const store = getDocumentStore()
    const document = store.get(documentId)

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify ownership
    if (document.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Parse request body
    let body: {
      name?: string
      status?: 'pending' | 'processing' | 'ready' | 'error'
      chunkCount?: number
      metadata?: Record<string, unknown>
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Update document
    const updatedDocument: Document = {
      ...document,
      ...(body.name && { name: body.name }),
      ...(body.status && { status: body.status }),
      ...(body.chunkCount !== undefined && { chunkCount: body.chunkCount }),
      ...(body.metadata && { metadata: { ...document.metadata, ...body.metadata } }),
      updatedAt: new Date().toISOString(),
    }

    store.set(documentId, updatedDocument)

    return NextResponse.json({ document: updatedDocument })
  } catch (error) {
    console.error('Error updating document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/documents/[id]
 *
 * Soft-deletes a document (marks as SoftDeleted, schedules hard delete for 30 days).
 * Document remains in store but is excluded from queries.
 */
export async function DELETE(
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

    const store = getDocumentStore()
    const document = store.get(documentId)

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Verify ownership
    if (document.userId !== userId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Soft-delete: Set deletion status and schedule hard delete for 30 days
    const now = new Date()
    const hardDeleteDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days from now

    const updatedDocument: Document = {
      ...document,
      deletionStatus: 'SoftDeleted',
      deletedAt: now.toISOString(),
      hardDeleteScheduledAt: hardDeleteDate.toISOString(),
      updatedAt: now.toISOString(),
    }

    store.set(documentId, updatedDocument)

    // Log to audit trail
    const ipAddress = getClientIP(request)
    try {
      await logDocumentDelete(userId, documentId, document.name, ipAddress)
    } catch (auditError) {
      console.error('Failed to log document delete:', auditError)
    }

    return NextResponse.json({
      success: true,
      message: 'Document moved to trash. Will be permanently deleted in 30 days.',
      deletedAt: updatedDocument.deletedAt,
      hardDeleteScheduledAt: updatedDocument.hardDeleteScheduledAt,
    })
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * OPTIONS /api/documents/[id]
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
