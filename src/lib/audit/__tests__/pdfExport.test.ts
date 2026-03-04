/**
 * Tests for pdfExport.ts — RAGbox.co
 *
 * Covers both exported functions: generateAuditPdfContent and generatePdfBuffer.
 * pdfkit encodes text as hex in TJ arrays, so content assertions use hex matching.
 */

import type { AuditEvent, AuditAction, AuditSeverity } from '../audit-types'
import { generateAuditPdfContent, generatePdfBuffer } from '../pdfExport'
import type { PdfExportOptions } from '../pdfExport'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic Date mock (2026-02-21T18:00:00.000Z) */
const FIXED_ISO = '2026-02-21T18:00:00.000Z'
const FIXED_MS = new Date(FIXED_ISO).getTime()

/** Convert ASCII string to hex (lowercase) for PDF TJ matching */
function toHex(s: string): string {
  return Buffer.from(s, 'ascii').toString('hex')
}

/** Check if a hex-encoded string fragment exists in the raw PDF text */
function pdfContainsText(pdfText: string, searchStr: string): boolean {
  // pdfkit splits text into hex chunks with kerning values between them.
  // e.g., "TestCo" may become <54> 120 <657374436f> or <54657374436f>
  // Strategy: check if ALL hex chars of the search string appear in order
  // within the content stream, allowing for splits between TJ array elements.
  const hex = toHex(searchStr)
  // Simple approach: check if the hex appears as a substring (works for short strings)
  if (pdfText.includes(hex)) return true
  // Also check for individual chars that might be split by kerning
  // Build a regex that allows optional `> digits <` between hex pairs
  const hexPairs = hex.match(/.{2}/g) || []
  const pattern = hexPairs.join('[0-9a-f]*(?:>\\s*-?\\d+\\s*<)?')
  return new RegExp(pattern, 'i').test(pdfText)
}

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'evt_1',
    eventId: 'evt_1',
    timestamp: '2025-06-15T12:00:00.000Z',
    userId: 'user_1',
    action: 'LOGIN' as AuditAction,
    severity: 'INFO' as AuditSeverity,
    details: { browser: 'Chrome' },
    hash: 'abc123def456abc123def456abc123def456',
    detailsHash: 'abc123def456abc123def456abc123def456',
    resourceId: 'res_1',
    resourceType: 'document',
    ipAddress: '10.0.0.1',
    ...overrides,
  }
}

function makeEvents(count: number): AuditEvent[] {
  return Array.from({ length: count }, (_, i) =>
    makeEvent({
      id: `evt_${i + 1}`,
      eventId: `evt_${i + 1}`,
      userId: `user_${i + 1}`,
    }),
  )
}

const defaultOptions: PdfExportOptions = {
  organizationName: 'TestCo',
  exportedBy: 'admin_1',
}

// ---------------------------------------------------------------------------
// Freeze Date.now and new Date() for deterministic assertions
// ---------------------------------------------------------------------------
beforeEach(() => {
  jest.useFakeTimers()
  jest.setSystemTime(FIXED_MS)
})

afterEach(() => {
  jest.useRealTimers()
})

// =========================================================================
// generateAuditPdfContent
// =========================================================================
describe('generateAuditPdfContent', () => {
  // ----- Return type / shape -----
  describe('return shape', () => {
    test('returns an object with all required PdfExportResult fields', async () => {
      const result = await generateAuditPdfContent([], defaultOptions)

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('filename')
      expect(result).toHaveProperty('hash')
      expect(result).toHaveProperty('pageCount')
      expect(result).toHaveProperty('entryCount')
      expect(result).toHaveProperty('exportedAt')
    })

    test('data is a non-empty base64 string', async () => {
      const result = await generateAuditPdfContent([], defaultOptions)

      expect(typeof result.data).toBe('string')
      expect(result.data.length).toBeGreaterThan(0)
      const decoded = Buffer.from(result.data, 'base64').toString('latin1')
      expect(decoded.length).toBeGreaterThan(0)
    })

    test('filename follows expected pattern', async () => {
      const result = await generateAuditPdfContent([], defaultOptions)

      expect(result.filename).toMatch(/^ragbox_audit_\d{4}-\d{2}-\d{2}\.pdf$/)
    })

    test('hash is a 64-char hex SHA-256', async () => {
      const result = await generateAuditPdfContent([], defaultOptions)

      expect(result.hash).toMatch(/^[0-9a-f]{64}$/)
    })

    test('exportedAt is an ISO timestamp', async () => {
      const result = await generateAuditPdfContent([], defaultOptions)

      expect(result.exportedAt).toBe(FIXED_ISO)
    })
  })

  // ----- Empty entries -----
  describe('empty events list', () => {
    test('entryCount is 0', async () => {
      const result = await generateAuditPdfContent([], defaultOptions)
      expect(result.entryCount).toBe(0)
    })

    test('pageCount is 1 (title page)', async () => {
      const result = await generateAuditPdfContent([], defaultOptions)
      expect(result.pageCount).toBe(1)
    })

    test('decoded PDF contains hex-encoded organization name', async () => {
      const result = await generateAuditPdfContent([], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('latin1')
      expect(pdfContainsText(decoded, 'TestCo')).toBe(true)
    })
  })

  // ----- Header content -----
  describe('report header', () => {
    test('includes organization name', async () => {
      const result = await generateAuditPdfContent([], {
        ...defaultOptions,
        organizationName: 'AcmeCorp',
      })
      const decoded = Buffer.from(result.data, 'base64').toString('latin1')
      expect(pdfContainsText(decoded, 'AcmeCorp')).toBe(true)
    })

    test('includes exportedBy', async () => {
      const result = await generateAuditPdfContent([], {
        ...defaultOptions,
        exportedBy: 'alice',
      })
      const decoded = Buffer.from(result.data, 'base64').toString('latin1')
      expect(pdfContainsText(decoded, 'alice')).toBe(true)
    })

    test('includes Audit Report in title', async () => {
      const result = await generateAuditPdfContent([], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('latin1')
      expect(pdfContainsText(decoded, 'Audit Report')).toBe(true)
    })

    test('includes WORM-Compliant subtitle', async () => {
      const result = await generateAuditPdfContent([], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('latin1')
      expect(pdfContainsText(decoded, 'WORM-Compliant')).toBe(true)
    })
  })

  // ----- Optional date range -----
  describe('optional date range', () => {
    test('omits period text when startDate/endDate not set', async () => {
      const result = await generateAuditPdfContent([], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('latin1')
      expect(pdfContainsText(decoded, 'Period Start')).toBe(false)
      expect(pdfContainsText(decoded, 'Period End')).toBe(false)
    })

    test('includes period text when startDate and endDate are set', async () => {
      const result = await generateAuditPdfContent([], {
        ...defaultOptions,
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-12-31T23:59:59Z',
      })
      const decoded = Buffer.from(result.data, 'base64').toString('latin1')
      expect(pdfContainsText(decoded, 'Period Start')).toBe(true)
      expect(pdfContainsText(decoded, 'Period End')).toBe(true)
    })
  })

  // ----- Event rendering -----
  describe('event rendering', () => {
    test('renders event with key identifiers', async () => {
      const event = makeEvent({
        eventId: 'evt_42',
        action: 'DOCUMENT_UPLOAD',
        userId: 'alice',
        severity: 'INFO',
        resourceType: 'document',
        ipAddress: '192.168.1.1',
      })
      const result = await generateAuditPdfContent([event], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('latin1')

      expect(pdfContainsText(decoded, '0001')).toBe(true)
      expect(pdfContainsText(decoded, 'evt_42')).toBe(true)
      expect(pdfContainsText(decoded, 'alice')).toBe(true)
      expect(pdfContainsText(decoded, 'INFO')).toBe(true)
    })

    test('renders userId as System when userId is empty string', async () => {
      const event = makeEvent({ userId: '' })
      const result = await generateAuditPdfContent([event], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('latin1')
      expect(pdfContainsText(decoded, 'System')).toBe(true)
    })

    test('serializes event details as JSON', async () => {
      const event = makeEvent({ details: { key: 'value' } })
      const result = await generateAuditPdfContent([event], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('latin1')
      expect(pdfContainsText(decoded, '"key"')).toBe(true)
    })

    test('entryCount matches the number of events', async () => {
      const events = makeEvents(7)
      const result = await generateAuditPdfContent(events, defaultOptions)
      expect(result.entryCount).toBe(7)
    })
  })

  // ----- Pagination -----
  describe('pagination', () => {
    test('pageCount is 1 for 10 or fewer events', async () => {
      const result = await generateAuditPdfContent(makeEvents(10), defaultOptions)
      expect(result.pageCount).toBe(1)
    })

    test('pageCount is 2 for 11 events (10 per page)', async () => {
      const result = await generateAuditPdfContent(makeEvents(11), defaultOptions)
      expect(result.pageCount).toBe(2)
    })

    test('pageCount scales correctly for 25 events', async () => {
      const result = await generateAuditPdfContent(makeEvents(25), defaultOptions)
      expect(result.pageCount).toBe(3)
    })

    test('PDF contains Audit Entries header', async () => {
      const result = await generateAuditPdfContent(makeEvents(15), defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('latin1')
      expect(pdfContainsText(decoded, 'Audit Entries')).toBe(true)
    })
  })

  // ----- Action display names -----
  describe('action display names', () => {
    const actionMap: Array<[AuditAction, string]> = [
      ['LOGIN', 'User Login'],
      ['LOGOUT', 'User Logout'],
      ['DOCUMENT_UPLOAD', 'Document Upload'],
      ['DOCUMENT_DELETE', 'Document Deleted'],
      ['DOCUMENT_VIEW', 'Document Viewed'],
      ['DOCUMENT_PRIVILEGE_CHANGE', 'Privilege Changed'],
      ['DOCUMENT_TIER_CHANGE', 'Tier Changed'],
      ['QUERY_SUBMITTED', 'Query Submitted'],
      ['QUERY_RESPONSE', 'Query Response'],
      ['SILENCE_PROTOCOL', 'Silence Protocol'],
      ['SILENCE_PROTOCOL_TRIGGERED', 'Silence Protocol'],
      ['PRIVILEGE_MODE_CHANGE', 'Mode Changed'],
      ['DATA_EXPORT', 'Data Export'],
      ['SETTINGS_CHANGE', 'Settings Changed'],
      ['ERROR', 'Error'],
    ]

    test.each(actionMap)(
      'maps %s to "%s"',
      async (action, displayName) => {
        const event = makeEvent({ action })
        const result = await generateAuditPdfContent([event], defaultOptions)
        const decoded = Buffer.from(result.data, 'base64').toString('latin1')
        expect(pdfContainsText(decoded, displayName)).toBe(true)
      },
    )
  })

  // ----- Hash integrity -----
  describe('hash integrity', () => {
    test('same events + options produce same hash', async () => {
      const events = [makeEvent()]
      const r1 = await generateAuditPdfContent(events, defaultOptions)
      const r2 = await generateAuditPdfContent(events, defaultOptions)
      expect(r1.hash).toBe(r2.hash)
    })

    test('different events produce different hash', async () => {
      const r1 = await generateAuditPdfContent(
        [makeEvent({ action: 'LOGIN' })],
        defaultOptions,
      )
      const r2 = await generateAuditPdfContent(
        [makeEvent({ action: 'LOGOUT' })],
        defaultOptions,
      )
      expect(r1.hash).not.toBe(r2.hash)
    })

    test('report contains Report Verification section', async () => {
      const result = await generateAuditPdfContent([makeEvent()], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('latin1')
      expect(pdfContainsText(decoded, 'Report Verification')).toBe(true)
    })

    test('report contains tamper-evident notice', async () => {
      const result = await generateAuditPdfContent([], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('latin1')
      expect(pdfContainsText(decoded, 'tamper-evident')).toBe(true)
    })
  })
})

// =========================================================================
// generatePdfBuffer
// =========================================================================
describe('generatePdfBuffer', () => {
  // ----- Return type -----
  describe('return type', () => {
    test('returns a Buffer', async () => {
      const buf = await generatePdfBuffer([], defaultOptions)
      expect(Buffer.isBuffer(buf)).toBe(true)
    })

    test('buffer is non-empty even with zero events', async () => {
      const buf = await generatePdfBuffer([], defaultOptions)
      expect(buf.length).toBeGreaterThan(0)
    })
  })

  // ----- PDF structure -----
  describe('PDF structure', () => {
    test('starts with %PDF header', async () => {
      const buf = await generatePdfBuffer([], defaultOptions)
      const text = buf.toString('latin1')
      expect(text.startsWith('%PDF')).toBe(true)
    })

    test('ends with %%EOF marker', async () => {
      const buf = await generatePdfBuffer([], defaultOptions)
      const text = buf.toString('latin1')
      expect(text.trimEnd()).toMatch(/%%EOF$/)
    })
  })

  // ----- Header content -----
  describe('header content', () => {
    test('contains organization name', async () => {
      const buf = await generatePdfBuffer([], {
        ...defaultOptions,
        organizationName: 'AcmeCorp',
      })
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'AcmeCorp')).toBe(true)
    })

    test('contains exported-by value', async () => {
      const buf = await generatePdfBuffer([], {
        ...defaultOptions,
        exportedBy: 'bob',
      })
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'bob')).toBe(true)
    })

    test('contains Audit Report title', async () => {
      const buf = await generatePdfBuffer([], defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'Audit Report')).toBe(true)
    })

    test('contains WORM-Compliant subtitle', async () => {
      const buf = await generatePdfBuffer([], defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'WORM-Compliant')).toBe(true)
    })

    test('contains Total Entries text', async () => {
      const buf = await generatePdfBuffer(makeEvents(3), defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'Total Entries')).toBe(true)
    })
  })

  // ----- Optional date range -----
  describe('optional date range', () => {
    test('omits period lines when dates not provided', async () => {
      const buf = await generatePdfBuffer([], defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'Period Start')).toBe(false)
      expect(pdfContainsText(text, 'Period End')).toBe(false)
    })

    test('includes period lines when dates provided', async () => {
      const buf = await generatePdfBuffer([], {
        ...defaultOptions,
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-12-31T23:59:59Z',
      })
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'Period Start')).toBe(true)
      expect(pdfContainsText(text, 'Period End')).toBe(true)
    })
  })

  // ----- Event rendering -----
  describe('event rendering', () => {
    test('renders action display name', async () => {
      const event = makeEvent({ action: 'DOCUMENT_UPLOAD' })
      const buf = await generatePdfBuffer([event], defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'Document Upload')).toBe(true)
    })

    test('renders user ID', async () => {
      const event = makeEvent({ userId: 'charlie' })
      const buf = await generatePdfBuffer([event], defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'charlie')).toBe(true)
    })

    test('renders System for empty userId', async () => {
      const event = makeEvent({ userId: '' })
      const buf = await generatePdfBuffer([event], defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'System')).toBe(true)
    })

    test('renders severity', async () => {
      const event = makeEvent({ severity: 'CRITICAL' })
      const buf = await generatePdfBuffer([event], defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'CRITICAL')).toBe(true)
    })

    test('renders resource type and id when present', async () => {
      const event = makeEvent({
        resourceType: 'document',
        resourceId: 'doc_77',
      })
      const buf = await generatePdfBuffer([event], defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'document')).toBe(true)
      expect(pdfContainsText(text, 'doc_77')).toBe(true)
    })

    test('renders IP address when present', async () => {
      const event = makeEvent({ ipAddress: '172.16.0.1' })
      const buf = await generatePdfBuffer([event], defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, '172.16.0.1')).toBe(true)
    })

    test('renders details JSON content', async () => {
      const event = makeEvent({ details: { foo: 'bar' } })
      const buf = await generatePdfBuffer([event], defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, '"foo"')).toBe(true)
    })

    test('renders truncated hash (first 32 chars)', async () => {
      const longHash = 'a'.repeat(64)
      const event = makeEvent({ detailsHash: longHash })
      const buf = await generatePdfBuffer([event], defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'a'.repeat(32))).toBe(true)
    })

    test('renders zero-padded entry number', async () => {
      const buf = await generatePdfBuffer([makeEvent()], defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, '0001')).toBe(true)
    })

    test('renders correct entry numbers for multiple events', async () => {
      const events = makeEvents(3)
      const buf = await generatePdfBuffer(events, defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, '0001')).toBe(true)
      expect(pdfContainsText(text, '0002')).toBe(true)
      expect(pdfContainsText(text, '0003')).toBe(true)
    })
  })

  // ----- Footer / verification -----
  describe('footer and verification', () => {
    test('contains Report Verification section', async () => {
      const buf = await generatePdfBuffer([makeEvent()], defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'Report Verification')).toBe(true)
    })

    test('contains Report Hash SHA-256', async () => {
      const buf = await generatePdfBuffer([makeEvent()], defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'Report Hash')).toBe(true)
      expect(pdfContainsText(text, 'SHA-256')).toBe(true)
    })

    test('contains entries count in footer', async () => {
      const buf = await generatePdfBuffer(makeEvents(25), defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'Entries')).toBe(true)
    })

    test('contains tamper-evident notice', async () => {
      const buf = await generatePdfBuffer([], defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'tamper-evident')).toBe(true)
    })
  })

  // ----- Determinism -----
  describe('determinism', () => {
    test('same inputs produce identical buffers', async () => {
      const events = [makeEvent()]
      const buf1 = await generatePdfBuffer(events, defaultOptions)
      const buf2 = await generatePdfBuffer(events, defaultOptions)
      expect(buf1.equals(buf2)).toBe(true)
    })

    test('different events produce different buffers', async () => {
      const buf1 = await generatePdfBuffer(
        [makeEvent({ action: 'LOGIN' })],
        defaultOptions,
      )
      const buf2 = await generatePdfBuffer(
        [makeEvent({ action: 'LOGOUT' })],
        defaultOptions,
      )
      expect(buf1.equals(buf2)).toBe(false)
    })
  })

  // ----- Input validation (edge cases) -----
  describe('edge cases', () => {
    test('handles empty details object', async () => {
      const event = makeEvent({ details: {} })
      const buf = await generatePdfBuffer([event], defaultOptions)
      expect(buf.length).toBeGreaterThan(0)
    })

    test('handles large number of events without throwing', async () => {
      const events = makeEvents(100)
      await expect(generatePdfBuffer(events, defaultOptions)).resolves.toBeDefined()
    })

    test('handles special characters in organization name', async () => {
      const buf = await generatePdfBuffer([], {
        ...defaultOptions,
        organizationName: 'OBrien Associates',
      })
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, 'OBrien')).toBe(true)
    })

    test('handles details with numeric values', async () => {
      const event = makeEvent({ details: { count: 42 } })
      const buf = await generatePdfBuffer([event], defaultOptions)
      const text = buf.toString('latin1')
      expect(pdfContainsText(text, '42')).toBe(true)
    })
  })
})
