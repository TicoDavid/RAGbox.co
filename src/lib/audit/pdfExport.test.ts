import { generatePdfBuffer } from './pdfExport'
import type { AuditEvent } from './audit-types'

/** Convert ASCII string to hex for PDF TJ matching */
function toHex(s: string): string {
  return Buffer.from(s, 'ascii').toString('hex')
}

/** Check if hex-encoded text exists in raw PDF output */
function pdfContainsText(pdfText: string, searchStr: string): boolean {
  const hex = toHex(searchStr)
  if (pdfText.includes(hex)) return true
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
  test('returns a Buffer', async () => {
    const buf = await generatePdfBuffer([], {
      organizationName: 'TestCo',
      exportedBy: 'user_1',
    })
    expect(Buffer.isBuffer(buf)).toBe(true)
  })

  test('contains organization name', async () => {
    const buf = await generatePdfBuffer([], {
      organizationName: 'AcmeCorp',
      exportedBy: 'admin',
    })
    const text = buf.toString('latin1')
    expect(pdfContainsText(text, 'AcmeCorp')).toBe(true)
  })

  test('contains entry data', async () => {
    const buf = await generatePdfBuffer(
      [makeEvent({ action: 'DOCUMENT_UPLOAD', userId: 'alice' })],
      { organizationName: 'TestCo', exportedBy: 'alice' },
    )
    const text = buf.toString('latin1')
    expect(pdfContainsText(text, 'Document Upload')).toBe(true)
    expect(pdfContainsText(text, 'alice')).toBe(true)
  })

  test('contains hash footer', async () => {
    const buf = await generatePdfBuffer([makeEvent()], {
      organizationName: 'TestCo',
      exportedBy: 'user_1',
    })
    const text = buf.toString('latin1')
    expect(pdfContainsText(text, 'Report Hash')).toBe(true)
  })

  test('handles empty array', async () => {
    const buf = await generatePdfBuffer([], {
      organizationName: 'TestCo',
      exportedBy: 'user_1',
    })
    const text = buf.toString('latin1')
    expect(pdfContainsText(text, 'Total Entries')).toBe(true)
    expect(pdfContainsText(text, 'Report Verification')).toBe(true)
  })

  test('respects date range options', async () => {
    const buf = await generatePdfBuffer([makeEvent()], {
      organizationName: 'TestCo',
      exportedBy: 'user_1',
      startDate: '2025-01-01T00:00:00Z',
      endDate: '2025-12-31T23:59:59Z',
    })
    const text = buf.toString('latin1')
    expect(pdfContainsText(text, 'Period Start')).toBe(true)
    expect(pdfContainsText(text, 'Period End')).toBe(true)
  })
})
