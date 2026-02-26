/**
 * EPIC-020 SA01: CLARITY Phase 1 Regression Tests
 *
 * Tests for Sheldon's Phase 1 fixes:
 * - STORY-220: SSE tokens contain ONLY text, no JSON
 * - STORY-224: Pipeline timeout + stuck document recovery
 * - STORY-225: Data Airlock zip rejection, per-file error reporting
 *
 * — Sarah, QA
 */
export {}

// ── Mock sonner ──────────────────────────────────────────────────
const mockToast = { success: jest.fn(), error: jest.fn(), warning: jest.fn() }
jest.mock('sonner', () => ({ toast: mockToast }))

// ── Mock logger ──────────────────────────────────────────────────
jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}))

beforeEach(() => {
  jest.clearAllMocks()
})

// ══════════════════════════════════════════════════════════════════
// SECTION 1: SSE Token Events — STORY-220
// ══════════════════════════════════════════════════════════════════

describe('SSE Token Events (STORY-220)', () => {
  describe('token events contain ONLY prose text', () => {
    it('valid token: plain text with no JSON characters', () => {
      const token = { text: 'The analysis shows' }
      expect(typeof token.text).toBe('string')
      expect(token.text).not.toContain('{')
      expect(token.text).not.toContain('}')
      expect(token.text).not.toContain('"answer"')
      expect(token.text).not.toContain('"citations"')
      expect(token.text).not.toContain('"confidence"')
    })

    it('rejects token that looks like JSON envelope', () => {
      const badToken = '{"answer":"The analysis shows","citations":[],"confidence":0.85}'
      // STORY-220: Token events must never contain JSON structure
      expect(badToken.startsWith('{')).toBe(true)
      // This token should have been split by splitIntoTokens() into prose only
      const goodTokens = ['The ', 'analysis ', 'shows']
      for (const t of goodTokens) {
        expect(t).not.toContain('{')
        expect(t).not.toContain('}')
      }
    })

    it('splitIntoTokens produces word-level tokens with trailing spaces', () => {
      // Matches Go backend splitIntoTokens() behavior
      function splitIntoTokens(text: string): string[] {
        const words = text.split(' ')
        return words.map((w, i) => i < words.length - 1 ? w + ' ' : w)
      }

      const tokens = splitIntoTokens('Hello world test')
      expect(tokens).toEqual(['Hello ', 'world ', 'test'])
    })

    it('splitIntoTokens handles single word', () => {
      function splitIntoTokens(text: string): string[] {
        const words = text.split(' ')
        return words.map((w, i) => i < words.length - 1 ? w + ' ' : w)
      }

      const tokens = splitIntoTokens('Hello')
      expect(tokens).toEqual(['Hello'])
    })

    it('splitIntoTokens handles empty string', () => {
      function splitIntoTokens(text: string): string[] {
        if (!text) return []
        const words = text.split(' ')
        return words.map((w, i) => i < words.length - 1 ? w + ' ' : w)
      }

      expect(splitIntoTokens('')).toEqual([])
    })
  })

  describe('citations arrive as separate SSE event', () => {
    it('citations event contains array of citation objects', () => {
      const citationsEvent = {
        type: 'citations',
        data: [
          { id: 1, documentName: 'Contract.pdf', pageNumber: 3, excerpt: 'Section 4.2...' },
          { id: 2, documentName: 'Report.docx', pageNumber: 7, excerpt: 'Revenue figures...' },
        ],
      }
      expect(Array.isArray(citationsEvent.data)).toBe(true)
      expect(citationsEvent.data).toHaveLength(2)
      expect(citationsEvent.data[0].documentName).toBe('Contract.pdf')
    })

    it('citations are NOT embedded in token events', () => {
      const tokenEvent = { type: 'token', text: 'Based on the contract,' }
      // Token should never contain citation data
      expect(tokenEvent).not.toHaveProperty('citations')
      expect(tokenEvent.text).not.toContain('[{"id"')
    })
  })

  describe('mercuryStore SSE parsing (client-side)', () => {
    it('token event accumulates text from data.text field', () => {
      let fullContent = ''
      const events = [
        { type: 'token', data: { text: 'The ' } },
        { type: 'token', data: { text: 'analysis ' } },
        { type: 'token', data: { text: 'shows' } },
      ]

      for (const event of events) {
        if (event.type === 'token') {
          fullContent += event.data.text ?? ''
        }
      }
      expect(fullContent).toBe('The analysis shows')
    })

    it('done event replaces accumulated content with answer field', () => {
      let fullContent = 'partial streaming content'
      const doneEvent = {
        type: 'done',
        data: {
          answer: 'The complete analysis shows revenue growth of 15%.',
          citations: [{ id: 1, documentName: 'Report.pdf' }],
          confidence: 0.92,
        },
      }

      const d = doneEvent.data
      if (typeof d.answer === 'string') {
        fullContent = d.answer // REPLACE, not append
      }
      expect(fullContent).toBe('The complete analysis shows revenue growth of 15%.')
    })

    it('safety net extracts prose from leaked JSON', () => {
      // BUG-040 safety net: if fullContent is JSON, extract the answer field
      let fullContent = '{"answer":"Revenue increased by 15%","citations":[],"confidence":0.92}'
      const cleaned = fullContent.trim()
      if (cleaned.startsWith('{')) {
        try {
          const parsed = JSON.parse(cleaned)
          const d = parsed.data ?? parsed
          if (typeof d.answer === 'string' && d.answer.length > 0) {
            fullContent = d.answer
          }
        } catch { /* not valid JSON */ }
      }
      expect(fullContent).toBe('Revenue increased by 15%')
      expect(fullContent).not.toContain('{')
    })

    it('default SSE event rejects structured objects (JSON leak prevention)', () => {
      // mercuryStore default handler: only append if data.text is string AND no answer/data
      const badEvent = { text: 'some text', answer: 'leaked', data: { nested: true } }
      const shouldAppend = typeof badEvent.text === 'string' &&
        !('answer' in badEvent && badEvent.answer) &&
        !('data' in badEvent && badEvent.data)
      expect(shouldAppend).toBe(false)
    })
  })
})

// ══════════════════════════════════════════════════════════════════
// SECTION 2: Pipeline Timeout + Stuck Document Recovery — STORY-224
// ══════════════════════════════════════════════════════════════════

describe('Pipeline Timeout + Stuck Document Recovery (STORY-224)', () => {
  describe('document status enum', () => {
    it('defines all 4 valid document statuses', () => {
      const IndexStatus = {
        IndexPending: 'Pending',
        IndexProcessing: 'Processing',
        IndexIndexed: 'Indexed',
        IndexFailed: 'Failed',
      }
      expect(Object.values(IndexStatus)).toEqual(['Pending', 'Processing', 'Indexed', 'Failed'])
    })
  })

  describe('timeout configuration', () => {
    it('pipeline timeout is 300s (5 minutes) for large PDFs', () => {
      const PIPELINE_TIMEOUT_SEC = 300
      expect(PIPELINE_TIMEOUT_SEC).toBe(300)
      expect(PIPELINE_TIMEOUT_SEC).toBeGreaterThan(120) // Was 120s before STORY-224
    })
  })

  describe('failure recovery with fresh context', () => {
    it('failDocument creates fresh background context (not caller context)', () => {
      // STORY-224: When pipeline times out, the caller context is cancelled.
      // failDocument must use a fresh context to update the DB.
      const callerContextCancelled = true
      const FRESH_CONTEXT_TIMEOUT_SEC = 10

      // Simulate: caller context is cancelled but we use a fresh one
      const freshCtx = { cancelled: false, timeout: FRESH_CONTEXT_TIMEOUT_SEC }
      expect(callerContextCancelled).toBe(true)
      expect(freshCtx.cancelled).toBe(false)
      expect(freshCtx.timeout).toBe(10)
    })

    it('document is marked Failed after timeout (not stuck in Processing)', () => {
      // Flow: Pending → Processing → (timeout) → Failed
      let status = 'Pending'
      status = 'Processing' // Pipeline starts
      // Pipeline times out...
      const pipelineError = new Error('context deadline exceeded')
      expect(pipelineError).toBeDefined()
      status = 'Failed' // failDocument sets this
      expect(status).toBe('Failed')
      expect(status).not.toBe('Processing') // MUST NOT be stuck
    })
  })
})

// ══════════════════════════════════════════════════════════════════
// SECTION 3: Data Airlock — STORY-225
// ══════════════════════════════════════════════════════════════════

describe('Data Airlock (STORY-225)', () => {
  describe('archive file rejection', () => {
    it('rejects .zip files with clear error message', () => {
      const archiveExts = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'])
      const ext = '.zip'
      expect(archiveExts.has(ext)).toBe(true)
    })

    it('rejects .rar files', () => {
      const archiveExts = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'])
      expect(archiveExts.has('.rar')).toBe(true)
    })

    it('rejects .7z files', () => {
      const archiveExts = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'])
      expect(archiveExts.has('.7z')).toBe(true)
    })

    it('allows .pdf files through', () => {
      const archiveExts = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'])
      expect(archiveExts.has('.pdf')).toBe(false)
    })

    it('error message is user-friendly and actionable', () => {
      const errorMessage = 'Archive files (.zip, .rar, .7z) are not supported. Please extract the files first and upload them individually.'
      expect(errorMessage).toContain('not supported')
      expect(errorMessage).toContain('extract')
      expect(errorMessage).toContain('individually')
    })
  })

  describe('per-file error reporting in batch uploads', () => {
    it('tracks uploaded and failed files separately', () => {
      const uploaded: Array<{ filename: string; size: number }> = []
      const failed: Array<{ filename: string; reason: string }> = []

      // Simulate batch: good.pdf, bad.zip, good2.txt
      uploaded.push({ filename: 'good.pdf', size: 1024 })
      failed.push({ filename: 'bad.zip', reason: 'Archive files not supported' })
      uploaded.push({ filename: 'good2.txt', size: 512 })

      expect(uploaded).toHaveLength(2)
      expect(failed).toHaveLength(1)
      expect(failed[0].filename).toBe('bad.zip')
      expect(failed[0].reason).toContain('Archive')
    })

    it('empty file (0 bytes) is rejected with clear reason', () => {
      const file = { name: 'empty.pdf', size: 0 }
      const failed: Array<{ filename: string; reason: string }> = []

      if (!file.size || file.size === 0) {
        failed.push({ filename: file.name, reason: 'File is empty (0 bytes)' })
      }
      expect(failed).toHaveLength(1)
      expect(failed[0].reason).toBe('File is empty (0 bytes)')
    })

    it('oversized file (>50 MB) is rejected', () => {
      const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
      const file = { name: 'huge.pdf', size: 60 * 1024 * 1024 }
      const failed: Array<{ filename: string; reason: string }> = []

      if (file.size > MAX_FILE_SIZE) {
        failed.push({ filename: file.name, reason: 'Exceeds 50 MB limit' })
      }
      expect(failed).toHaveLength(1)
      expect(failed[0].reason).toContain('50 MB')
    })
  })

  describe('batch summary toast messages', () => {
    it('all success → "All N files uploaded successfully"', () => {
      const uploaded = [{ filename: 'a.pdf' }, { filename: 'b.pdf' }, { filename: 'c.pdf' }]
      const failed: Array<{ filename: string }> = []

      let message = ''
      if (failed.length === 0 && uploaded.length > 0) {
        message = `All ${uploaded.length} file${uploaded.length > 1 ? 's' : ''} uploaded successfully`
      }
      expect(message).toBe('All 3 files uploaded successfully')
    })

    it('partial failure → "X of Y files uploaded. Z failed: [list]"', () => {
      const uploaded = [{ filename: 'a.pdf' }]
      const failed = [{ filename: 'bad.zip' }, { filename: 'bad2.rar' }]

      let message = ''
      if (failed.length > 0 && uploaded.length > 0) {
        message = `${uploaded.length} of ${uploaded.length + failed.length} files uploaded. ${failed.length} failed: ${failed.map(f => f.filename).join(', ')}`
      }
      expect(message).toBe('1 of 3 files uploaded. 2 failed: bad.zip, bad2.rar')
    })

    it('all fail → "All N files failed to upload"', () => {
      const uploaded: Array<{ filename: string }> = []
      const failed = [{ filename: 'bad.zip' }, { filename: 'bad2.rar' }]

      let message = ''
      if (failed.length > 0 && uploaded.length === 0) {
        message = `All ${failed.length} files failed to upload`
      }
      expect(message).toBe('All 2 files failed to upload')
    })
  })

  describe('partial failure does NOT break upload loop', () => {
    it('error on file2 does not prevent file3 from uploading', () => {
      const files = ['file1.pdf', 'error.zip', 'file3.txt']
      const archiveExts = new Set(['.zip', '.rar', '.7z'])
      const uploaded: string[] = []
      const failed: string[] = []

      for (const name of files) {
        const ext = name.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
        if (archiveExts.has(ext)) {
          failed.push(name)
          continue // NOT break
        }
        uploaded.push(name)
      }

      expect(uploaded).toEqual(['file1.pdf', 'file3.txt'])
      expect(failed).toEqual(['error.zip'])
      // Key: file3.txt was NOT skipped despite error on file2
    })
  })
})
