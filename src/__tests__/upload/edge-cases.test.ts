/**
 * STORY-195b: Upload Edge Case Test Coverage
 *
 * Tests the /api/documents/extract POST handler for edge cases:
 * file size limits, unsupported types, empty files, special characters,
 * duplicate filenames, rate limiting, and concurrent uploads.
 *
 * Tests 1-6 run against existing validation in the extract route.
 * Test 7 (upload during active ingestion) documents behavior.
 */

// ── Mocks (declared before any imports that reference them) ────────────

const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}))

const mockWriteAuditEntry = jest.fn()
jest.mock('@/lib/audit/auditWriter', () => ({
  writeAuditEntry: (...args: unknown[]) => mockWriteAuditEntry(...args),
}))

const mockInvalidateUserCache = jest.fn()
jest.mock('@/lib/cache/queryCache', () => ({
  invalidateUserCache: (...args: unknown[]) => mockInvalidateUserCache(...args),
}))

const mockPublishMessage = jest.fn()
jest.mock('@google-cloud/pubsub', () => ({
  PubSub: jest.fn().mockImplementation(() => ({
    topic: () => ({
      publishMessage: (...args: unknown[]) => mockPublishMessage(...args),
    }),
  })),
}))

// ── Imports (after mocks) ────────────────────────────────────

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/documents/extract/route'

// ── Helpers ──────────────────────────────────────────────────

function authenticateAs(id = 'user-001', email = 'test@ragbox.co') {
  mockGetToken.mockResolvedValue({ id, email })
}

function unauthenticate() {
  mockGetToken.mockResolvedValue(null)
}

/**
 * Build a NextRequest with FormData containing a File.
 * For numeric contentOrSize: creates a File with that many bytes of actual content.
 * For string contentOrSize: creates a File with that string as content.
 */
function buildUploadRequest(
  filename: string,
  contentOrSize: string | number,
  mimeType = 'application/pdf',
  folderId?: string,
): NextRequest {
  const formData = new FormData()

  let file: File
  if (typeof contentOrSize === 'number') {
    // Create a file with actual content of the specified size
    const buffer = new Uint8Array(contentOrSize)
    file = new File([buffer], filename, { type: mimeType })
  } else {
    file = new File([contentOrSize], filename, { type: mimeType })
  }

  formData.append('file', file)
  if (folderId) {
    formData.append('folderId', folderId)
  }

  return new NextRequest('http://localhost:3000/api/documents/extract', {
    method: 'POST',
    body: formData,
  })
}

async function parseResponse(res: Response): Promise<Record<string, unknown>> {
  return res.json()
}

// ── Mock backend responses ──────────────────────────────────

const originalFetch = global.fetch

function mockFetchSuccess() {
  global.fetch = jest.fn().mockImplementation((url: string | URL | Request) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url

    // Backend extract endpoint → return signed URL
    if (urlStr.includes('/api/documents/extract')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            url: 'https://storage.googleapis.com/ragbox-docs/signed-url',
            documentId: 'doc-test-' + Math.random().toString(36).slice(2, 8),
            objectName: 'uploads/user-001/doc/file.pdf',
          },
        }),
      })
    }

    // GCS signed upload → success
    if (urlStr.includes('storage.googleapis.com')) {
      return Promise.resolve({ ok: true })
    }

    // Ingest trigger → success
    if (urlStr.includes('/ingest')) {
      return Promise.resolve({ ok: true, status: 202 })
    }

    return Promise.reject(new Error(`Unmocked fetch: ${urlStr}`))
  }) as jest.Mock
}

// ── Setup / Teardown ────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = originalFetch
  mockWriteAuditEntry.mockResolvedValue(undefined)
  mockInvalidateUserCache.mockResolvedValue(undefined)
  mockPublishMessage.mockResolvedValue(undefined)
})

afterEach(() => {
  global.fetch = originalFetch
})

// ── Tests ───────────────────────────────────────────────────

describe('Upload Edge Cases — STORY-195b', () => {
  // 1. File too large (> 50MB) → error toast, no upload attempt
  test('rejects file exceeding 50MB limit with 413 status', async () => {
    authenticateAs()
    // Create a file that's 1 byte over the 50MB limit.
    // Allocating 50MB+1 in a test is fine for Node.js.
    const overLimit = 50 * 1024 * 1024 + 1
    const req = buildUploadRequest('large-document.pdf', overLimit)

    const res = await POST(req)
    const body = await parseResponse(res)

    expect(res.status).toBe(413)
    expect(body.success).toBe(false)
    expect(body.error).toContain('50MB')
  })

  // 2. Unsupported file type (.exe, .zip, .mp4) → rejection message
  test('rejects unsupported file types with descriptive error', async () => {
    authenticateAs()

    const unsupportedTypes = [
      { name: 'malware.exe', mime: 'application/x-msdownload' },
      { name: 'archive.zip', mime: 'application/zip' },
      { name: 'video.mp4', mime: 'video/mp4' },
    ]

    for (const { name, mime } of unsupportedTypes) {
      const req = buildUploadRequest(name, 'test content', mime)
      const res = await POST(req)
      const body = await parseResponse(res)

      expect(res.status).toBe(400)
      expect(body.success).toBe(false)
      expect(typeof body.error).toBe('string')
      expect((body.error as string).toLowerCase()).toContain('unsupported')
    }
  })

  // 3. Duplicate filename → warning dialog
  // NOTE: Duplicate detection requires STORY-195 (Jordan) to implement
  // filename uniqueness check against existing vault contents.
  // Currently no duplicate check exists — documenting expected behavior.
  test('accepts duplicate filename (no dedup check exists yet)', async () => {
    authenticateAs()
    mockFetchSuccess()

    // Upload same filename twice — both should succeed (no dedup logic yet)
    const req1 = buildUploadRequest('contract.pdf', 'content v1')
    const res1 = await POST(req1)
    expect(res1.status).toBe(200)

    const req2 = buildUploadRequest('contract.pdf', 'content v2')
    const res2 = await POST(req2)
    expect(res2.status).toBe(200)
    // When STORY-195 lands: expect warning dialog or conflict response
  })

  // 4. Rapid uploads (> 10 in 60s) → rate limit message
  // NOTE: Rate limiting is enforced at the middleware layer (30 req/min
  // per user on /api/documents/extract), not within the route handler.
  // This test validates the route itself doesn't crash under rapid calls.
  test('route handler does not crash under rapid sequential calls', async () => {
    authenticateAs()
    mockFetchSuccess()

    const results: number[] = []
    for (let i = 0; i < 5; i++) {
      const req = buildUploadRequest(`rapid-${i}.pdf`, `content ${i}`)
      const res = await POST(req)
      results.push(res.status)
    }

    // All should succeed at the route level (rate limiting is middleware)
    expect(results.every(s => s === 200)).toBe(true)
  })

  // 5. Empty file (0 bytes) → rejection
  test('handles empty file (0 bytes) without crashing', async () => {
    authenticateAs()
    mockFetchSuccess()

    const req = buildUploadRequest('empty.pdf', '')
    const res = await POST(req)

    // The route should either reject 0-byte files (400) or forward to
    // backend which validates sizeBytes > 0. Either way, must not crash.
    // Current behavior: file.size = 0 passes frontend validation
    // (no explicit 0-byte check) and forwards to backend with sizeBytes=0.
    expect(res.status).toBeLessThan(500)
    // Document gap: frontend should add explicit empty file check → 400
  })

  // 6. File with special characters in name → handled gracefully
  test('handles filenames with special characters gracefully', async () => {
    authenticateAs()
    mockFetchSuccess()

    const specialNames = [
      'café résumé.pdf',           // Accented characters
      '合同文件.pdf',                // Chinese characters
      'file (1) [copy].pdf',       // Brackets and parentheses
      "contract's final.pdf",      // Apostrophe
      'report & analysis.pdf',     // Ampersand
      'doc#2024.pdf',              // Hash
    ]

    for (const name of specialNames) {
      const req = buildUploadRequest(name, 'test content')
      const res = await POST(req)

      // Should either succeed (200) or return a validation error (400)
      // but NEVER crash (500) or hang
      expect(res.status).toBeLessThan(500)
    }
  })

  // 7. Upload during active ingestion → queued or warned
  // The pipeline has a concurrency guard (map[string]bool) that prevents
  // duplicate processing of the same documentId. A new upload creates a
  // new documentId, so concurrent uploads always succeed at the upload
  // stage — ingestion is async via PubSub.
  test('second upload creates new document (does not conflict with active ingestion)', async () => {
    authenticateAs()
    mockFetchSuccess()

    // First upload
    const req1 = buildUploadRequest('report.pdf', 'version 1')
    const res1 = await POST(req1)
    expect(res1.status).toBe(200)
    const body1 = await parseResponse(res1)
    expect(body1.success).toBe(true)

    // Second upload while first is "still ingesting"
    // (ingestion is async via PubSub — upload itself always succeeds)
    const req2 = buildUploadRequest('report-v2.pdf', 'version 2')
    const res2 = await POST(req2)
    expect(res2.status).toBe(200)
    const body2 = await parseResponse(res2)
    expect(body2.success).toBe(true)
  })

  // Additional: Auth required
  test('returns 401 when not authenticated', async () => {
    unauthenticate()

    const req = buildUploadRequest('test.pdf', 'content')
    const res = await POST(req)
    const body = await parseResponse(res)

    expect(res.status).toBe(401)
    expect(body.success).toBe(false)
  })
})
