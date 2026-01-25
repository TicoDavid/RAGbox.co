/**
 * Document Recovery API - RAGbox.co
 *
 * PATCH /api/documents/[id]/recover - Recover a soft-deleted document
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getDocumentStore, Document } from '../../route'

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
 * PATCH /api/documents/[id]/recover
 *
 * Recovers a soft-deleted document by restoring its Active status.
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

    // Check deletion status
    if (document.deletionStatus === 'Active') {
      return NextResponse.json(
        { error: 'Document is not in trash', code: 'NOT_DELETED' },
        { status: 400 }
      )
    }

    if (document.deletionStatus === 'HardDeleted') {
      return NextResponse.json(
        { error: 'Document has been permanently deleted and cannot be recovered', code: 'HARD_DELETED' },
        { status: 410 }
      )
    }

    // Recover document
    const updatedDocument: Document = {
      ...document,
      deletionStatus: 'Active',
      deletedAt: null,
      hardDeleteScheduledAt: null,
      updatedAt: new Date().toISOString(),
    }

    store.set(documentId, updatedDocument)

    return NextResponse.json({
      success: true,
      message: 'Document recovered successfully',
      document: updatedDocument,
    })
  } catch (error) {
    console.error('Error recovering document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * OPTIONS /api/documents/[id]/recover
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
