import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''

// Fallback MIME type detection by file extension when browser reports empty type
const EXT_MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

function resolveContentType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
  return EXT_MIME_MAP[ext] || file.type || 'application/octet-stream'
}

export async function POST(request: NextRequest) {
  // Auth check
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Unable to determine user identity' },
      { status: 401 }
    )
  }

  // Step 1: Parse FormData from frontend
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Expected multipart form data' },
      { status: 400 }
    )
  }

  const file = formData.get('file') as File | null
  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: 'No file provided' },
      { status: 400 }
    )
  }

  const contentType = resolveContentType(file)
  const folderId = formData.get('folderId') as string | null

  // Validate content type before sending to backend
  const ALLOWED_TYPES = new Set(Object.values(EXT_MIME_MAP))
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json(
      { success: false, error: `Unsupported file type: ${contentType}. Supported: PDF, DOCX, TXT, CSV, XLSX, PNG, JPG` },
      { status: 400 }
    )
  }

  // Validate file size before loading into memory (50MB limit)
  const MAX_FILE_SIZE = 50 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { success: false, error: 'File exceeds 50MB limit' },
      { status: 413 }
    )
  }

  // Step 2: Request signed upload URL from Go backend
  const backendUrl = new URL('/api/documents/extract', GO_BACKEND_URL)
  let backendRes: Response
  try {
    backendRes = await fetch(backendUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_AUTH_SECRET,
        'X-User-ID': userId,
      },
      body: JSON.stringify({
        filename: file.name,
        contentType,
        sizeBytes: file.size,
        ...(folderId ? { folderId } : {}),
      }),
    })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to reach backend' },
      { status: 502 }
    )
  }

  if (!backendRes.ok) {
    const err = await backendRes.json().catch(() => ({ error: 'Backend error' }))
    return NextResponse.json(
      { success: false, error: err.error || 'Failed to generate upload URL' },
      { status: backendRes.status }
    )
  }

  const backendData = await backendRes.json()
  // backendData = { success: true, data: { url, documentId, objectName } }
  const { url: signedUrl, documentId, objectName } = backendData.data

  // Validate signed URL points to GCS (prevent SSRF)
  try {
    const parsed = new URL(signedUrl)
    if (parsed.hostname !== 'storage.googleapis.com') {
      return NextResponse.json(
        { success: false, error: 'Invalid upload URL' },
        { status: 502 }
      )
    }
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid upload URL' },
      { status: 502 }
    )
  }

  // Step 3: Upload file to signed GCS URL
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

  // Step 4: Trigger ingestion pipeline on Go backend (with retry)
  const ingestUrl = new URL(`/api/documents/${documentId}/ingest`, GO_BACKEND_URL)
  let ingestOk = false
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ingestRes = await fetch(ingestUrl.toString(), {
        method: 'POST',
        headers: {
          'X-Internal-Auth': INTERNAL_AUTH_SECRET,
          'X-User-ID': userId,
        },
      })
      if (ingestRes.ok || ingestRes.status === 202) {
        ingestOk = true
        break
      }
      // Non-retryable client errors
      if (ingestRes.status >= 400 && ingestRes.status < 500) break
    } catch {
      // Network error — retry after short delay
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  const ingestWarning = ingestOk ? undefined : 'Document uploaded but indexing failed to start. Re-upload or contact support.'

  // Step 5: Return metadata to frontend (include warning if ingest failed)
  const bucketName = process.env.GCS_BUCKET_NAME || ''
  return NextResponse.json({
    success: true,
    data: {
      documentId,
      storagePath: objectName,
      gcsUri: bucketName ? `gs://${bucketName}/${objectName}` : objectName,
      mimeType: contentType,
    },
    ...(ingestWarning ? { warning: ingestWarning } : {}),
  })
}
