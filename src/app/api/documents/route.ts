/**
 * Documents API - RAGbox.co
 *
 * GET /api/documents - List all documents for the user
 * POST /api/documents - Create a new document (after upload)
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { logDocumentUpload } from '@/lib/audit'

export interface Document {
  id: string
  name: string
  originalName: string
  size: number
  type: string
  mimeType: string
  storagePath: string
  uploadedAt: string
  updatedAt: string
  userId: string
  isPrivileged: boolean
  chunkCount: number
  status: 'pending' | 'processing' | 'ready' | 'error'
  metadata?: Record<string, unknown>
}

// In-memory document store (replace with database in production)
// Shared across requests via module scope
const documentStore = new Map<string, Document>()

// Initialize with demo documents
function initDemoDocuments() {
  if (documentStore.size > 0) return

  const demoUserId = 'demo_user'
  const documents: Document[] = [
    {
      id: 'doc_1',
      name: 'Contract_NDA_2024.pdf',
      originalName: 'Contract_NDA_2024.pdf',
      size: 2450000,
      type: 'pdf',
      mimeType: 'application/pdf',
      storagePath: `users/${demoUserId}/documents/doc_1.pdf`,
      uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      userId: demoUserId,
      isPrivileged: false,
      chunkCount: 15,
      status: 'ready',
    },
    {
      id: 'doc_2',
      name: 'Financial_Statement_Q4.xlsx',
      originalName: 'Financial_Statement_Q4.xlsx',
      size: 1200000,
      type: 'xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      storagePath: `users/${demoUserId}/documents/doc_2.xlsx`,
      uploadedAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      userId: demoUserId,
      isPrivileged: true,
      chunkCount: 8,
      status: 'ready',
    },
    {
      id: 'doc_3',
      name: 'Legal_Brief_v3.docx',
      originalName: 'Legal_Brief_v3.docx',
      size: 890000,
      type: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      storagePath: `users/${demoUserId}/documents/doc_3.docx`,
      uploadedAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      userId: demoUserId,
      isPrivileged: false,
      chunkCount: 12,
      status: 'ready',
    },
    {
      id: 'doc_4',
      name: 'Attorney_Client_Memo.pdf',
      originalName: 'Attorney_Client_Memo.pdf',
      size: 456000,
      type: 'pdf',
      mimeType: 'application/pdf',
      storagePath: `users/${demoUserId}/documents/doc_4.pdf`,
      uploadedAt: new Date(Date.now() - 7200000).toISOString(),
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
      userId: demoUserId,
      isPrivileged: true,
      chunkCount: 6,
      status: 'ready',
    },
  ]

  documents.forEach((doc) => documentStore.set(doc.id, doc))
}

// Initialize demo data
initDemoDocuments()

// Export for use by other API routes
export function getDocumentStore(): Map<string, Document> {
  initDemoDocuments()
  return documentStore
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
 * GET /api/documents
 *
 * Query parameters:
 * - sort: 'name' | 'date' | 'size' (default 'date')
 * - order: 'asc' | 'desc' (default 'desc')
 * - privileged: 'true' | 'false' | 'all' (default 'all')
 * - status: 'pending' | 'processing' | 'ready' | 'error' | 'all' (default 'all')
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sort = searchParams.get('sort') || 'date'
    const order = searchParams.get('order') || 'desc'
    const privilegedFilter = searchParams.get('privileged') || 'all'
    const statusFilter = searchParams.get('status') || 'all'

    // Get user's documents
    let documents = Array.from(documentStore.values()).filter((doc) => doc.userId === userId)

    // Apply filters
    if (privilegedFilter !== 'all') {
      const isPrivileged = privilegedFilter === 'true'
      documents = documents.filter((doc) => doc.isPrivileged === isPrivileged)
    }

    if (statusFilter !== 'all') {
      documents = documents.filter((doc) => doc.status === statusFilter)
    }

    // Apply sorting
    documents.sort((a, b) => {
      let comparison = 0
      switch (sort) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'size':
          comparison = a.size - b.size
          break
        case 'date':
        default:
          comparison = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime()
          break
      }
      return order === 'desc' ? -comparison : comparison
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
 *
 * Create a new document record after file upload.
 *
 * Request body:
 * {
 *   "name": string,
 *   "size": number,
 *   "mimeType": string,
 *   "storagePath": string
 * }
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
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Validate required fields
    if (!body.name || !body.size || !body.mimeType || !body.storagePath) {
      return NextResponse.json(
        { error: 'Missing required fields: name, size, mimeType, storagePath' },
        { status: 400 }
      )
    }

    // Extract file type from mime type
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

    // Generate document ID
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
      uploadedAt: now,
      updatedAt: now,
      userId,
      isPrivileged: false,
      chunkCount: 0,
      status: 'pending',
    }

    documentStore.set(docId, document)

    // Log to audit trail
    const ipAddress = getClientIP(request)
    try {
      await logDocumentUpload(userId, docId, body.name, ipAddress)
    } catch (auditError) {
      console.error('Failed to log document upload:', auditError)
    }

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    console.error('Error creating document:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * OPTIONS /api/documents
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
