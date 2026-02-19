import { generatePdfBuffer } from './pdfExport'
import type { AuditEvent } from './audit-types'

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'evt_1',
    eventId: 'evt_1',
    timestamp: '2025-06-15T12:00:00.000Z',
    userId: 'user_1',
    action: 'LOGIN',
    severity: 'INFO',
    details: { browser: 'Chrome' },
    hash: 'abc123def456abc123def456abc123def456',
    detailsHash: 'abc123def456abc123def456abc123def456',
    resourceId: 'res_1',
    ipAddress: '10.0.0.1',
    ...overrides,
  }
}

describe('generatePdfBuffer', () => {
  test('returns a Buffer', () => {
    const buf = generatePdfBuffer([], {
      organizationName: 'TestCo',
      exportedBy: 'user_1',
    })
    expect(Buffer.isBuffer(buf)).toBe(true)
  })

  test('contains organization name', () => {
    const buf = generatePdfBuffer([], {
      organizationName: 'Acme Corp',
      exportedBy: 'admin',
    })
    const text = buf.toString('utf-8')
    expect(text).toContain('Acme Corp')
  })

  test('contains entry data', () => {
    const buf = generatePdfBuffer(
      [makeEvent({ action: 'DOCUMENT_UPLOAD', userId: 'alice' })],
      { organizationName: 'TestCo', exportedBy: 'alice' },
    )
    const text = buf.toString('utf-8')
    expect(text).toContain('Document Upload')
    expect(text).toContain('alice')
  })

  test('contains hash footer', () => {
    const buf = generatePdfBuffer([makeEvent()], {
      organizationName: 'TestCo',
      exportedBy: 'user_1',
    })
    const text = buf.toString('utf-8')
    expect(text).toContain('Report Hash (SHA-256)')
  })

  test('handles empty array', () => {
    const buf = generatePdfBuffer([], {
      organizationName: 'TestCo',
      exportedBy: 'user_1',
    })
    const text = buf.toString('utf-8')
    expect(text).toContain('Total Entries:   0')
    expect(text).toContain('END OF AUDIT REPORT')
  })

  test('respects date range options', () => {
    const buf = generatePdfBuffer([makeEvent()], {
      organizationName: 'TestCo',
      exportedBy: 'user_1',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-12-31T23:59:59Z',
    })
    const text = buf.toString('utf-8')
    expect(text).toContain('Period Start')
    expect(text).toContain('Period End')
  })
})
