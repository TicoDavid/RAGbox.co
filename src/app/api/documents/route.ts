/**
 * Documents API - RAGbox.co
 *
 * GET /api/documents - List all documents for the user
 * POST /api/documents - Create a new document (after upload)
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logDocumentUpload } from '@/lib/audit'
import {
  getDocumentsForUser,
  setDocument,
  ensureUser,
  STORAGE_LIMITS,
  type Document,
} from '@/lib/documents/store'

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
 * GET /api/documents
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sort = (searchParams.get('sort') || 'date') as 'name' | 'date' | 'size'
    const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc'
    const privilegedFilter = searchParams.get('privileged') || 'all'
    const statusFilter = searchParams.get('status') || 'all'

    const documents = await getDocumentsForUser(userId, {
      sort,
      order,
      privileged: privilegedFilter !== 'all' ? privilegedFilter === 'true' : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    })

    return NextResponse.json({
      documents,
      total: documents.length,
    })
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/documents
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: {
      name?: string
      size?: number
      mimeType?: string
      storagePath?: string
      storageUri?: string
      vaultId?: string
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.name || !body.size || !body.mimeType || !body.storagePath) {
      return NextResponse.json(
        { error: 'Missing required fields: name, size, mimeType, storagePath' },
        { status: 400 }
      )
    }

    if (body.size > STORAGE_LIMITS.MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `File size exceeds maximum allowed size of ${STORAGE_LIMITS.MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
          code: 'FILE_TOO_LARGE',
          maxSize: STORAGE_LIMITS.MAX_FILE_SIZE_BYTES,
        },
        { status: 413 }
      )
    }

    const typeMap: Record<string, string> = {
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'text/plain': 'txt',
      'text/csv': 'csv',
    }
    const fileType = typeMap[body.mimeType] || body.mimeType.split('/')[1] || 'file'

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const now = new Date().toISOString()

    const document: Document = {
      id: docId,
      name: body.name,
      originalName: body.name,
      size: body.size,
      type: fileType,
      mimeType: body.mimeType,
      storagePath: body.storagePath,
      storageUri: body.storageUri,
      uploadedAt: now,
      updatedAt: now,
      userId,
      isPrivileged: false,
      securityTier: 0,
      chunkCount: 0,
      status: 'pending',
      deletionStatus: 'Active',
      deletedAt: null,
      hardDeleteScheduledAt: null,
      vaultId: body.vaultId,
    }

    await ensureUser({ id: userId, email: `${userId}@placeholder.ragbox.co` })
    await setDocument(document)

    const ipAddress = getClientIP(request)
    try {
      await logDocumentUpload(userId, docId, body.name, body.size, ipAddress)
    } catch (auditError) {
      console.error('Failed to log document upload:', auditError)
    }

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    console.error('Error creating document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}
