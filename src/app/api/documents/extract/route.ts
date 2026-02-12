import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''

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

  const contentType = file.type || 'application/octet-stream'
  const folderId = formData.get('folderId') as string | null

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

  // Step 4: Trigger ingestion pipeline on Go backend (fire-and-forget)
  const ingestUrl = new URL(`/api/documents/${documentId}/ingest`, GO_BACKEND_URL)
  try {
    const ingestRes = await fetch(ingestUrl.toString(), {
      method: 'POST',
      headers: {
        'X-Internal-Auth': INTERNAL_AUTH_SECRET,
        'X-User-ID': userId,
      },
    })
    if (!ingestRes.ok) {
      console.warn(`[extract] Ingest trigger returned ${ingestRes.status} for ${documentId}`)
    }
  } catch (err) {
    console.warn(`[extract] Failed to trigger ingest for ${documentId}:`, err)
  }

  // Step 5: Return metadata to frontend
  const bucketName = process.env.GCS_BUCKET_NAME || ''
  return NextResponse.json({
    success: true,
    data: {
      documentId,
      storagePath: objectName,
      gcsUri: bucketName ? `gs://${bucketName}/${objectName}` : objectName,
      mimeType: contentType,
    },
  })
}
