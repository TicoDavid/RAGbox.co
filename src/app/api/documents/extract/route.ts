import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { PubSub } from '@google-cloud/pubsub'
import { invalidateUserCache } from '@/lib/cache/queryCache'
import { writeAuditEntry } from '@/lib/audit/auditWriter'
import { triggerDocumentExtraction } from '@/lib/cygraph/extractionTrigger'
import { isAudioFile, transcribeAudio } from '@/lib/transcription/transcriptionService'
import { logger } from '@/lib/logger'

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''
const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'ragbox-sovereign-prod'

let pubsubClient: PubSub | null = null
function getPubSub(): PubSub {
  if (!pubsubClient) {
    pubsubClient = new PubSub({ projectId: GCP_PROJECT })
  }
  return pubsubClient
}

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
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.md': 'text/markdown',
  '.json': 'application/json',
  // Audio formats for meeting transcription (FINAL WAVE Task 10)
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.webm': 'audio/webm',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
}

// All MIME types we accept (including browser-reported variants)
const ALLOWED_MIMES = new Set([
  ...Object.values(EXT_MIME_MAP),
  'application/x-pdf',            // Some browsers report this for PDF
  'image/jpg',                     // Non-standard but common
  'text/markdown',                 // .md files
  'text/x-markdown',              // .md files (variant)
  // Audio formats for meeting transcription
  'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave',
  'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/webm', 'audio/ogg',
  'audio/flac', 'audio/x-flac',
])

function resolveContentType(file: File): string {
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
  // Prefer extension-based mapping (canonical) over browser-reported type
  if (EXT_MIME_MAP[ext]) return EXT_MIME_MAP[ext]
  if (file.type && file.type !== 'application/octet-stream') return file.type
  return 'application/octet-stream'
}

function isAllowedType(contentType: string, ext: string): boolean {
  // Strip charset/params from MIME type for comparison
  const baseMime = contentType.split(';')[0].trim().toLowerCase()
  // Allow if MIME is in the allowed set OR extension is in EXT_MIME_MAP
  return ALLOWED_MIMES.has(baseMime) || ext in EXT_MIME_MAP
}

export async function POST(request: NextRequest) {
  // Auth check
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
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

  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
  const contentType = resolveContentType(file)
  const folderId = formData.get('folderId') as string | null

  // STORY-225: Clear error for archive files (zip, rar, 7z, tar, gz)
  const archiveExts = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'])
  if (archiveExts.has(ext)) {
    return NextResponse.json(
      { success: false, error: 'Archive files (.zip, .rar, .7z) are not supported. Please extract the files first and upload them individually.' },
      { status: 400 }
    )
  }

  // Validate content type before sending to backend
  if (!isAllowedType(contentType, ext)) {
    return NextResponse.json(
      { success: false, error: `Unsupported file type: ${contentType} (${ext}). Supported: PDF, DOC, DOCX, TXT, CSV, XLS, XLSX, PPTX, PNG, JPG, GIF, WebP, MD, JSON, MP3, WAV, M4A, WebM, OGG, FLAC` },
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

  const bucketName = process.env.GCS_BUCKET_NAME || ''

  // Step 3b: Audio transcription (Meeting Transcription — FINAL WAVE Task 10)
  // If the file is audio, transcribe it and store as a transcript document
  if (isAudioFile(contentType, file.name)) {
    transcribeAndStore(documentId, userId, Buffer.from(fileBuffer), contentType, file.name).catch(err => {
      logger.error('[Upload] Audio transcription failed:', err)
    })

    writeAuditEntry(userId, 'document.upload', documentId, {
      filename: file.name,
      mimeType: contentType,
      sizeBytes: file.size,
      type: 'audio_transcript',
    }).catch(() => {})

    invalidateUserCache(userId).catch(() => {})

    return NextResponse.json({
      success: true,
      data: {
        documentId,
        storagePath: objectName,
        gcsUri: bucketName ? `gs://${bucketName}/${objectName}` : objectName,
        mimeType: contentType,
        status: 'transcribing',
        type: 'transcript',
      },
      warning: 'Audio file uploaded — transcription in progress. It will appear in your vault shortly.',
    })
  }

  // Step 4: Trigger ingestion pipeline on Go backend (with retry)
  const ingestUrl = new URL(`/api/documents/${documentId}/ingest`, GO_BACKEND_URL)
  let ingestOk = false
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ingestRes = await fetch(ingestUrl.toString(), {
        method: 'POST',
        headers: {
          'Content-Length': '0',
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
  // Step 4b: Publish to Pub/Sub for async worker (safety net + retry support)
  // If Go backend ingest succeeds, the worker will see 'Indexed' and skip.
  // If Go backend ingest fails, the worker will process the document.
  try {
    const topic = getPubSub().topic('ragbox-document-processing')
    await topic.publishMessage({
      json: {
        documentId,
        userId,
        bucketName,
        objectPath: objectName,
        originalName: file.name,
        mimeType: contentType,
        uploadedAt: new Date().toISOString(),
      },
    })
  } catch (pubsubErr) {
    // Non-fatal — Go backend ingest is the primary path
    logger.error('[Upload] Pub/Sub publish failed:', pubsubErr)
  }

  // Audit log (best-effort)
  writeAuditEntry(userId, 'document.upload', documentId, {
    filename: file.name,
    mimeType: contentType,
    sizeBytes: file.size,
  }).catch(() => {})

  // Invalidate query cache — new document may change RAG results
  invalidateUserCache(userId).catch(() => {})

  // CyGraph: fire-and-forget entity/claim/relationship extraction
  triggerDocumentExtraction(documentId, userId).catch(() => {})

  const ingestWarning = ingestOk ? undefined : 'Document uploaded — processing queued. It will be indexed shortly.'

  // Step 5: Return metadata to frontend
  return NextResponse.json({
    success: true,
    data: {
      documentId,
      storagePath: objectName,
      gcsUri: bucketName ? `gs://${bucketName}/${objectName}` : objectName,
      mimeType: contentType,
      status: 'processing',
    },
    ...(ingestWarning ? { warning: ingestWarning } : {}),
  })
}

/**
 * Async: transcribe audio, store transcript as document content, trigger ingestion.
 * Called fire-and-forget for audio uploads.
 */
async function transcribeAndStore(
  documentId: string,
  userId: string,
  audioBuffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<void> {
  const result = await transcribeAudio(audioBuffer, mimeType)

  if (!result.text) {
    logger.warn('[Upload] Audio transcription returned empty text', { documentId, fileName })
    return
  }

  const title = fileName.replace(/\.[^.]+$/, '')
  const header = `Meeting Transcript: ${title}\nDuration: ${Math.round(result.durationSeconds / 60)} minutes | Words: ${result.wordCount} | Confidence: ${Math.round(result.confidence * 100)}%\n\n`
  const fullText = header + result.text

  // Store transcript as document content via Go backend ingest
  const ingestUrl = new URL(`/api/documents/${documentId}/ingest`, GO_BACKEND_URL)
  const ingestRes = await fetch(ingestUrl.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Auth': INTERNAL_AUTH_SECRET,
      'X-User-ID': userId,
    },
    body: JSON.stringify({
      transcriptText: fullText,
      documentType: 'transcript',
      metadata: {
        type: 'transcript',
        durationSeconds: result.durationSeconds,
        wordCount: result.wordCount,
        confidence: result.confidence,
        originalFileName: fileName,
      },
    }),
  })

  if (!ingestRes.ok) {
    logger.error('[Upload] Transcript ingest failed:', ingestRes.status)
  }

  // CyGraph extraction on the transcript
  triggerDocumentExtraction(documentId, userId).catch(() => {})

  logger.info('[Upload] Audio transcription complete', {
    documentId,
    fileName,
    durationSeconds: result.durationSeconds,
    wordCount: result.wordCount,
  })
}
