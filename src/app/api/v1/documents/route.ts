/**
 * RAGbox Public API — Documents
 *
 * GET  /api/v1/documents — List documents (paginated)
 * POST /api/v1/documents — Upload a document (STORY-S05: wired to ingestion pipeline)
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey, hasScope } from '@/lib/api/apiKeyMiddleware'
import prisma from '@/lib/prisma'

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''

// Extension → canonical MIME type mapping
const EXT_MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.md': 'text/markdown',
  '.json': 'application/json',
}

const ALLOWED_MIMES = new Set([
  ...Object.values(EXT_MIME_MAP),
  'application/x-pdf',
  'text/x-markdown',
])

function resolveContentType(file: File): string {
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
  if (EXT_MIME_MAP[ext]) return EXT_MIME_MAP[ext]
  if (file.type && file.type !== 'application/octet-stream') return file.type
  return 'application/octet-stream'
}

function isAllowedType(contentType: string, ext: string): boolean {
  const baseMime = contentType.split(';')[0].trim().toLowerCase()
  return ALLOWED_MIMES.has(baseMime) || ext in EXT_MIME_MAP
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateApiKey(request)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
  }

  if (!hasScope(auth, 'read')) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)
  const status = searchParams.get('status') || undefined

  const where: Record<string, unknown> = {
    userId: auth.userId,
    tenantId: auth.tenantId,
    deletionStatus: 'Active',
  }
  if (status) where.indexStatus = status

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        fileType: true,
        sizeBytes: true,
        indexStatus: true,
        privilegeLevel: true,
        isRestricted: true,
        chunkCount: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.document.count({ where }),
  ])

  return NextResponse.json({ success: true, data: { documents, total, limit, offset } })
}

/**
 * POST /api/v1/documents — Upload a document via the public API.
 * STORY-S05: Wired to the same ingestion pipeline as the dashboard upload.
 *
 * Accepts multipart form data with a `file` field.
 * Returns { id, filename, status: "processing" } on success.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateApiKey(request)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
  }

  if (!hasScope(auth, 'write')) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions. "write" scope required.' }, { status: 403 })
  }

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Expected multipart form data with a "file" field' },
      { status: 400 }
    )
  }

  const file = formData.get('file') as File | null
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: 'No file provided. Send a "file" field in multipart form data.' },
      { status: 400 }
    )
  }

  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
  const contentType = resolveContentType(file)

  if (!isAllowedType(contentType, ext)) {
    return NextResponse.json(
      { success: false, error: `Unsupported file type: ${contentType}. Supported: PDF, DOC, DOCX, TXT, CSV, XLS, XLSX, PPTX, MD, JSON` },
      { status: 400 }
    )
  }

  // Validate file size (50MB limit)
  const MAX_FILE_SIZE = 50 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: 'File exceeds 50MB limit' },
      { status: 413 }
    )
  }

  // Step 1: Request signed upload URL from Go backend
  const backendUrl = new URL('/api/documents/extract', GO_BACKEND_URL)
  let backendRes: Response
  try {
    backendRes = await fetch(backendUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_AUTH_SECRET,
        'X-User-ID': auth.userId,
      },
      body: JSON.stringify({
        filename: file.name,
        contentType,
        sizeBytes: file.size,
      }),
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Backend service unavailable' },
      { status: 502 }
    )
  }

  if (!backendRes.ok) {
    const err = await backendRes.json().catch(() => ({ error: 'Backend error' }))
    return NextResponse.json(
      { success: false, error: err.error || 'Failed to initiate upload' },
      { status: backendRes.status }
    )
  }

  const backendData = await backendRes.json()
  const { url: signedUrl, documentId, objectName } = backendData.data

  // SSRF guard: validate signed URL points to GCS
  try {
    const parsed = new URL(signedUrl)
    if (parsed.hostname !== 'storage.googleapis.com') {
      return NextResponse.json({ success: false, error: 'Invalid upload URL' }, { status: 502 })
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid upload URL' }, { status: 502 })
  }

  // Step 2: Upload file to GCS via signed URL
  const fileBuffer = await file.arrayBuffer()
  let uploadRes: Response
  try {
    uploadRes = await fetch(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: fileBuffer,
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to upload file to storage' },
      { status: 502 }
    )
  }

  if (!uploadRes.ok) {
    return NextResponse.json(
      { success: false, error: `Storage upload failed (${uploadRes.status})` },
      { status: 502 }
    )
  }

  // Step 3: Trigger ingestion pipeline on Go backend (with retry)
  const ingestUrl = new URL(`/api/documents/${documentId}/ingest`, GO_BACKEND_URL)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ingestRes = await fetch(ingestUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Length': '0',
          'X-Internal-Auth': INTERNAL_AUTH_SECRET,
          'X-User-ID': auth.userId,
        },
      })
      if (ingestRes.ok || ingestRes.status === 202) break
      if (ingestRes.status >= 400 && ingestRes.status < 500) break
    } catch {
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
  }

  // Step 4: Return V1 API response
  return NextResponse.json({
    success: true,
    data: {
      id: documentId,
      filename: file.name,
      mimeType: contentType,
      sizeBytes: file.size,
      status: 'processing',
    },
  })
}
