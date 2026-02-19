import { generateCsvBuffer } from './csvExport'
import type { AuditEvent } from './audit-types'

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'evt_1',
    eventId: 'evt_1',
    timestamp: '2025-06-15T12:00:00.000Z',
    userId: 'user_1',
    action: 'LOGIN',
    severity: 'INFO',
    details: { note: 'test' },
    hash: 'abc123',
    detailsHash: 'abc123',
    resourceId: 'res_1',
    ipAddress: '10.0.0.1',
    ...overrides,
  }
}

describe('generateCsvBuffer', () => {
  test('returns correct headers', () => {
    const buf = generateCsvBuffer([])
    const csv = buf.toString('utf-8')
    expect(csv).toBe(
      'Event ID,Timestamp,User ID,Action,Severity,Resource ID,IP Address,Details,Hash',
    )
  })

  test('includes all columns for an event', () => {
    const buf = generateCsvBuffer([makeEvent()])
    const lines = buf.toString('utf-8').split('\n')
    expect(lines).toHaveLength(2)

    const cols = lines[1].split(',')
    expect(cols[0]).toBe('evt_1')
    expect(cols[1]).toBe('2025-06-15T12:00:00.000Z')
    expect(cols[2]).toBe('user_1')
    expect(cols[3]).toBe('LOGIN')
    expect(cols[4]).toBe('INFO')
    expect(cols[5]).toBe('res_1')
    expect(cols[6]).toBe('10.0.0.1')
    // Details column is JSON-escaped
    expect(cols[7]).toContain('note')
    // Hash
    expect(cols[cols.length - 1]).toBe('abc123')
  })

  test('escapes commas in values', () => {
    const buf = generateCsvBuffer([
      makeEvent({ details: { note: 'hello, world' } }),
    ])
    const csv = buf.toString('utf-8')
    // The details column should be quoted
    expect(csv).toContain('"')
  })

  test('escapes double-quotes in values', () => {
    const buf = generateCsvBuffer([
      makeEvent({ details: { note: 'say "hi"' } }),
    ])
    const csv = buf.toString('utf-8')
    // Double-quotes should be doubled
    expect(csv).toContain('""')
  })

  test('handles empty array — header only', () => {
    const buf = generateCsvBuffer([])
    const lines = buf.toString('utf-8').split('\n')
    expect(lines).toHaveLength(1)
  })

  test('handles missing optional fields', () => {
    const buf = generateCsvBuffer([
      makeEvent({ resourceId: undefined, ipAddress: undefined }),
    ])
    const lines = buf.toString('utf-8').split('\n')
    const cols = lines[1].split(',')
    // resourceId and ipAddress should be empty strings
    expect(cols[5]).toBe('')
    expect(cols[6]).toBe('')
  })
})
