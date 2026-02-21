/**
 * Tests for pdfExport.ts — RAGbox.co
 *
 * Covers both exported functions: generateAuditPdfContent and generatePdfBuffer.
 * Pure Jest with mocks; no extra dependencies.
 */

import type { AuditEvent, AuditAction, AuditSeverity } from '../audit-types'
import { generateAuditPdfContent, generatePdfBuffer } from '../pdfExport'
import type { PdfExportOptions, PdfExportResult } from '../pdfExport'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic Date mock (2026-02-21T18:00:00.000Z) */
const FIXED_ISO = '2026-02-21T18:00:00.000Z'
const FIXED_MS = new Date(FIXED_ISO).getTime()

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
    test('returns an object with all required PdfExportResult fields', () => {
      const result = generateAuditPdfContent([], defaultOptions)

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('filename')
      expect(result).toHaveProperty('hash')
      expect(result).toHaveProperty('pageCount')
      expect(result).toHaveProperty('entryCount')
      expect(result).toHaveProperty('exportedAt')
    })

    test('data is a non-empty base64 string', () => {
      const result = generateAuditPdfContent([], defaultOptions)

      expect(typeof result.data).toBe('string')
      expect(result.data.length).toBeGreaterThan(0)
      // Should decode without error
      const decoded = Buffer.from(result.data, 'base64').toString('utf-8')
      expect(decoded.length).toBeGreaterThan(0)
    })

    test('filename follows expected pattern', () => {
      const result = generateAuditPdfContent([], defaultOptions)

      expect(result.filename).toMatch(/^ragbox_audit_\d{4}-\d{2}-\d{2}\.pdf$/)
    })

    test('hash is a 64-char hex SHA-256', () => {
      const result = generateAuditPdfContent([], defaultOptions)

      expect(result.hash).toMatch(/^[0-9a-f]{64}$/)
    })

    test('exportedAt is an ISO timestamp', () => {
      const result = generateAuditPdfContent([], defaultOptions)

      expect(result.exportedAt).toBe(FIXED_ISO)
    })
  })

  // ----- Empty entries -----
  describe('empty events list', () => {
    test('entryCount is 0', () => {
      const result = generateAuditPdfContent([], defaultOptions)
      expect(result.entryCount).toBe(0)
    })

    test('pageCount is 1 (title page)', () => {
      const result = generateAuditPdfContent([], defaultOptions)
      expect(result.pageCount).toBe(1)
    })

    test('decoded content contains Total Entries: 0', () => {
      const result = generateAuditPdfContent([], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('utf-8')
      expect(decoded).toContain('Total Entries: 0')
    })
  })

  // ----- Header content -----
  describe('report header', () => {
    test('includes organization name', () => {
      const result = generateAuditPdfContent([], {
        ...defaultOptions,
        organizationName: 'Acme Legal Corp',
      })
      const decoded = Buffer.from(result.data, 'base64').toString('utf-8')
      expect(decoded).toContain('Acme Legal Corp')
    })

    test('includes exportedBy', () => {
      const result = generateAuditPdfContent([], {
        ...defaultOptions,
        exportedBy: 'alice@example.com',
      })
      const decoded = Buffer.from(result.data, 'base64').toString('utf-8')
      expect(decoded).toContain('alice@example.com')
    })

    test('includes RAGBOX OFFICIAL AUDIT REPORT title', () => {
      const result = generateAuditPdfContent([], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('utf-8')
      expect(decoded).toContain('RAGBOX OFFICIAL AUDIT REPORT')
    })

    test('includes watermark text', () => {
      const result = generateAuditPdfContent([], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('utf-8')
      expect(decoded).toContain('WATERMARK: RAGbox Official Audit Report')
    })
  })

  // ----- Optional date range -----
  describe('optional date range', () => {
    test('omits period lines when startDate/endDate not set', () => {
      const result = generateAuditPdfContent([], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('utf-8')
      expect(decoded).not.toContain('Period Start')
      expect(decoded).not.toContain('Period End')
    })

    test('includes period lines when startDate and endDate are set', () => {
      const result = generateAuditPdfContent([], {
        ...defaultOptions,
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-12-31T23:59:59Z',
      })
      const decoded = Buffer.from(result.data, 'base64').toString('utf-8')
      expect(decoded).toContain('Period Start')
      expect(decoded).toContain('Period End')
    })
  })

  // ----- Event rendering -----
  describe('event rendering', () => {
    test('renders event entry with all expected fields', () => {
      const event = makeEvent({
        eventId: 'evt_42',
        action: 'DOCUMENT_UPLOAD',
        userId: 'alice',
        severity: 'INFO',
        resourceId: 'doc_99',
        resourceType: 'document',
        ipAddress: '192.168.1.1',
      })
      const result = generateAuditPdfContent([event], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('utf-8')

      expect(decoded).toContain('Entry #1')
      expect(decoded).toContain('evt_42')
      expect(decoded).toContain('Document Upload')
      expect(decoded).toContain('alice')
      expect(decoded).toContain('INFO')
      expect(decoded).toContain('doc_99')
      expect(decoded).toContain('document')
      expect(decoded).toContain('192.168.1.1')
    })

    test('renders userId as "System" when userId is empty string', () => {
      const event = makeEvent({ userId: '' })
      const result = generateAuditPdfContent([event], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('utf-8')
      expect(decoded).toContain('System')
    })

    test('omits optional resource/ip fields when undefined', () => {
      const event = makeEvent({
        resourceId: undefined,
        resourceType: undefined,
        ipAddress: undefined,
      })
      const result = generateAuditPdfContent([event], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('utf-8')
      expect(decoded).not.toContain('Resource ID:')
      expect(decoded).not.toContain('Resource Type:')
      expect(decoded).not.toContain('IP Address:')
    })

    test('serializes event details as JSON', () => {
      const event = makeEvent({ details: { key: 'value', nested: 123 } })
      const result = generateAuditPdfContent([event], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('utf-8')
      expect(decoded).toContain('"key"')
      expect(decoded).toContain('"value"')
      expect(decoded).toContain('123')
    })

    test('entryCount matches the number of events', () => {
      const events = makeEvents(7)
      const result = generateAuditPdfContent(events, defaultOptions)
      expect(result.entryCount).toBe(7)
    })
  })

  // ----- Pagination -----
  describe('pagination', () => {
    test('pageCount is 1 for 10 or fewer events', () => {
      const result = generateAuditPdfContent(makeEvents(10), defaultOptions)
      expect(result.pageCount).toBe(1)
    })

    test('pageCount is 2 for 11 events (10 per page)', () => {
      const result = generateAuditPdfContent(makeEvents(11), defaultOptions)
      expect(result.pageCount).toBe(2)
    })

    test('pageCount scales correctly for 25 events', () => {
      const result = generateAuditPdfContent(makeEvents(25), defaultOptions)
      // 0..9 => page 1, 10..19 => page 2, 20..24 => page 3
      expect(result.pageCount).toBe(3)
    })

    test('decoded content contains page markers', () => {
      const result = generateAuditPdfContent(makeEvents(15), defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('utf-8')
      expect(decoded).toContain('--- Page 1 ---')
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
      (action, displayName) => {
        const event = makeEvent({ action })
        const result = generateAuditPdfContent([event], defaultOptions)
        const decoded = Buffer.from(result.data, 'base64').toString('utf-8')
        expect(decoded).toContain(displayName)
      },
    )
  })

  // ----- Hash integrity -----
  describe('hash integrity', () => {
    test('same events + options produce same hash', () => {
      const events = [makeEvent()]
      const r1 = generateAuditPdfContent(events, defaultOptions)
      const r2 = generateAuditPdfContent(events, defaultOptions)
      expect(r1.hash).toBe(r2.hash)
    })

    test('different events produce different hash', () => {
      const r1 = generateAuditPdfContent(
        [makeEvent({ action: 'LOGIN' })],
        defaultOptions,
      )
      const r2 = generateAuditPdfContent(
        [makeEvent({ action: 'LOGOUT' })],
        defaultOptions,
      )
      expect(r1.hash).not.toBe(r2.hash)
    })

    test('report footer contains Report Hash', () => {
      const result = generateAuditPdfContent([makeEvent()], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('utf-8')
      expect(decoded).toContain(`Report Hash: ${result.hash}`)
    })

    test('report footer contains END OF AUDIT REPORT', () => {
      const result = generateAuditPdfContent([], defaultOptions)
      const decoded = Buffer.from(result.data, 'base64').toString('utf-8')
      expect(decoded).toContain('END OF AUDIT REPORT')
    })
  })
})

// =========================================================================
// generatePdfBuffer
// =========================================================================
describe('generatePdfBuffer', () => {
  // ----- Return type -----
  describe('return type', () => {
    test('returns a Buffer', () => {
      const buf = generatePdfBuffer([], defaultOptions)
      expect(Buffer.isBuffer(buf)).toBe(true)
    })

    test('buffer is non-empty even with zero events', () => {
      const buf = generatePdfBuffer([], defaultOptions)
      expect(buf.length).toBeGreaterThan(0)
    })
  })

  // ----- PDF structure -----
  describe('PDF structure', () => {
    test('starts with %PDF-1.4 header', () => {
      const text = generatePdfBuffer([], defaultOptions).toString('utf-8')
      expect(text.startsWith('%PDF-1.4')).toBe(true)
    })

    test('ends with %%EOF marker', () => {
      const text = generatePdfBuffer([], defaultOptions).toString('utf-8')
      expect(text.trimEnd()).toMatch(/%%EOF$/)
    })
  })

  // ----- Header content -----
  describe('header content', () => {
    test('contains organization name', () => {
      const text = generatePdfBuffer([], {
        ...defaultOptions,
        organizationName: 'Acme Corp',
      }).toString('utf-8')
      expect(text).toContain('Acme Corp')
    })

    test('contains exported-by value', () => {
      const text = generatePdfBuffer([], {
        ...defaultOptions,
        exportedBy: 'bob@example.com',
      }).toString('utf-8')
      expect(text).toContain('bob@example.com')
    })

    test('contains report title', () => {
      const text = generatePdfBuffer([], defaultOptions).toString('utf-8')
      expect(text).toContain('A U D I T   R E P O R T')
    })

    test('contains WORM-compliant watermark', () => {
      const text = generatePdfBuffer([], defaultOptions).toString('utf-8')
      expect(text).toContain('WORM-compliant')
    })

    test('contains total entries count', () => {
      const text = generatePdfBuffer(makeEvents(3), defaultOptions).toString('utf-8')
      expect(text).toContain('Total Entries:   3')
    })
  })

  // ----- Optional date range -----
  describe('optional date range', () => {
    test('omits period lines when dates not provided', () => {
      const text = generatePdfBuffer([], defaultOptions).toString('utf-8')
      expect(text).not.toContain('Period Start')
      expect(text).not.toContain('Period End')
    })

    test('includes period lines when dates provided', () => {
      const text = generatePdfBuffer([], {
        ...defaultOptions,
        startDate: '2025-01-01T00:00:00Z',
        endDate: '2025-12-31T23:59:59Z',
      }).toString('utf-8')
      expect(text).toContain('Period Start')
      expect(text).toContain('Period End')
    })
  })

  // ----- Event rendering -----
  describe('event rendering', () => {
    test('renders action display name', () => {
      const event = makeEvent({ action: 'DOCUMENT_UPLOAD' })
      const text = generatePdfBuffer([event], defaultOptions).toString('utf-8')
      expect(text).toContain('Document Upload')
    })

    test('renders user ID', () => {
      const event = makeEvent({ userId: 'charlie' })
      const text = generatePdfBuffer([event], defaultOptions).toString('utf-8')
      expect(text).toContain('charlie')
    })

    test('renders "System" for empty userId', () => {
      const event = makeEvent({ userId: '' })
      const text = generatePdfBuffer([event], defaultOptions).toString('utf-8')
      expect(text).toContain('System')
    })

    test('renders severity', () => {
      const event = makeEvent({ severity: 'CRITICAL' })
      const text = generatePdfBuffer([event], defaultOptions).toString('utf-8')
      expect(text).toContain('CRITICAL')
    })

    test('renders resource type and id when present', () => {
      const event = makeEvent({
        resourceType: 'document',
        resourceId: 'doc_77',
      })
      const text = generatePdfBuffer([event], defaultOptions).toString('utf-8')
      expect(text).toContain('document')
      expect(text).toContain('doc_77')
    })

    test('omits resource line when resourceType is undefined', () => {
      const event = makeEvent({ resourceType: undefined })
      const text = generatePdfBuffer([event], defaultOptions).toString('utf-8')
      expect(text).not.toMatch(/Resource:\s/)
    })

    test('renders IP address when present', () => {
      const event = makeEvent({ ipAddress: '172.16.0.1' })
      const text = generatePdfBuffer([event], defaultOptions).toString('utf-8')
      expect(text).toContain('172.16.0.1')
    })

    test('omits IP line when ipAddress is undefined', () => {
      const event = makeEvent({ ipAddress: undefined })
      const text = generatePdfBuffer([event], defaultOptions).toString('utf-8')
      expect(text).not.toMatch(/IP:\s+\d/)
    })

    test('renders details as formatted JSON', () => {
      const event = makeEvent({ details: { foo: 'bar', count: 42 } })
      const text = generatePdfBuffer([event], defaultOptions).toString('utf-8')
      expect(text).toContain('"foo"')
      expect(text).toContain('"bar"')
      expect(text).toContain('42')
    })

    test('renders truncated hash (first 32 chars)', () => {
      const longHash = 'a'.repeat(64)
      const event = makeEvent({ detailsHash: longHash })
      const text = generatePdfBuffer([event], defaultOptions).toString('utf-8')
      expect(text).toContain(`${'a'.repeat(32)}...`)
    })

    test('renders zero-padded entry number', () => {
      const text = generatePdfBuffer([makeEvent()], defaultOptions).toString('utf-8')
      expect(text).toContain('[0001]')
    })

    test('renders correct entry numbers for multiple events', () => {
      const events = makeEvents(3)
      const text = generatePdfBuffer(events, defaultOptions).toString('utf-8')
      expect(text).toContain('[0001]')
      expect(text).toContain('[0002]')
      expect(text).toContain('[0003]')
    })
  })

  // ----- Footer / verification -----
  describe('footer and verification', () => {
    test('contains Report Hash (SHA-256) line', () => {
      const text = generatePdfBuffer([makeEvent()], defaultOptions).toString('utf-8')
      expect(text).toContain('Report Hash (SHA-256)')
    })

    test('report hash is 64-char hex', () => {
      const text = generatePdfBuffer([makeEvent()], defaultOptions).toString('utf-8')
      const match = text.match(/Report Hash \(SHA-256\): ([0-9a-f]+)/)
      expect(match).not.toBeNull()
      expect(match![1]).toHaveLength(64)
    })

    test('contains page count', () => {
      const text = generatePdfBuffer(makeEvents(25), defaultOptions).toString('utf-8')
      // Math.ceil(25/10) = 3
      expect(text).toContain('Page Count:            3')
    })

    test('page count is 0 for empty events (Math.ceil(0/10) = 0)', () => {
      const text = generatePdfBuffer([], defaultOptions).toString('utf-8')
      expect(text).toContain('Page Count:            0')
    })

    test('contains tamper-evident notice', () => {
      const text = generatePdfBuffer([], defaultOptions).toString('utf-8')
      expect(text).toContain('tamper-evident')
    })

    test('contains END OF AUDIT REPORT', () => {
      const text = generatePdfBuffer([], defaultOptions).toString('utf-8')
      expect(text).toContain('END OF AUDIT REPORT')
    })
  })

  // ----- Determinism -----
  describe('determinism', () => {
    test('same inputs produce identical buffers', () => {
      const events = [makeEvent()]
      const buf1 = generatePdfBuffer(events, defaultOptions)
      const buf2 = generatePdfBuffer(events, defaultOptions)
      expect(buf1.equals(buf2)).toBe(true)
    })

    test('different events produce different buffers', () => {
      const buf1 = generatePdfBuffer(
        [makeEvent({ action: 'LOGIN' })],
        defaultOptions,
      )
      const buf2 = generatePdfBuffer(
        [makeEvent({ action: 'LOGOUT' })],
        defaultOptions,
      )
      expect(buf1.equals(buf2)).toBe(false)
    })
  })

  // ----- Input validation (edge cases) -----
  describe('edge cases', () => {
    test('handles empty details object', () => {
      const event = makeEvent({ details: {} })
      const text = generatePdfBuffer([event], defaultOptions).toString('utf-8')
      expect(text).toContain('Details:')
    })

    test('handles large number of events without throwing', () => {
      const events = makeEvents(100)
      expect(() => generatePdfBuffer(events, defaultOptions)).not.toThrow()
    })

    test('handles special characters in organization name', () => {
      const text = generatePdfBuffer([], {
        ...defaultOptions,
        organizationName: 'O\'Brien & Associates "LLC"',
      }).toString('utf-8')
      expect(text).toContain('O\'Brien & Associates "LLC"')
    })

    test('handles unicode in details', () => {
      const event = makeEvent({ details: { note: 'Zuruckgeben' } })
      const text = generatePdfBuffer([event], defaultOptions).toString('utf-8')
      expect(text).toContain('Zuruckgeben')
    })
  })
})
