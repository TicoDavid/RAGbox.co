import { mapPrismaToAuditEvent, type PrismaAuditRow } from './mappers'

function makeRow(overrides: Partial<PrismaAuditRow> = {}): PrismaAuditRow {
  return {
    id: 'cuid_abc123',
    userId: 'user_1',
    action: 'LOGIN',
    resourceId: 'res_42',
    severity: 'INFO',
    details: { browser: 'Chrome' },
    ipAddress: '10.0.0.1',
    userAgent: 'Mozilla/5.0',
    entryHash: 'abc123hash',
    createdAt: new Date('2025-06-15T12:00:00Z'),
    ...overrides,
  }
}

describe('mapPrismaToAuditEvent', () => {
  test('maps a full row correctly', () => {
    const event = mapPrismaToAuditEvent(makeRow())

    expect(event.id).toBe('cuid_abc123')
    expect(event.eventId).toBe('cuid_abc123')
    expect(event.timestamp).toBe('2025-06-15T12:00:00.000Z')
    expect(event.userId).toBe('user_1')
    expect(event.action).toBe('LOGIN')
    expect(event.severity).toBe('INFO')
    expect(event.details).toEqual({ browser: 'Chrome' })
    expect(event.hash).toBe('abc123hash')
    expect(event.detailsHash).toBe('abc123hash')
    expect(event.resourceId).toBe('res_42')
    expect(event.ip).toBe('10.0.0.1')
    expect(event.ipAddress).toBe('10.0.0.1')
    expect(event.userAgent).toBe('Mozilla/5.0')
  })

  test('handles null resourceId, ipAddress, userAgent', () => {
    const event = mapPrismaToAuditEvent(
      makeRow({ resourceId: null, ipAddress: null, userAgent: null }),
    )

    expect(event.resourceId).toBeUndefined()
    expect(event.ip).toBeUndefined()
    expect(event.ipAddress).toBeUndefined()
    expect(event.userAgent).toBeUndefined()
  })

  test('handles null details as empty object', () => {
    const event = mapPrismaToAuditEvent(makeRow({ details: null }))
    expect(event.details).toEqual({})
  })

  test('handles non-object details as empty object', () => {
    const event = mapPrismaToAuditEvent(makeRow({ details: 'string-value' as unknown }))
    expect(event.details).toEqual({})
  })

  test('converts createdAt Date to ISO string', () => {
    const date = new Date('2024-01-01T00:00:00Z')
    const event = mapPrismaToAuditEvent(makeRow({ createdAt: date }))
    expect(event.timestamp).toBe('2024-01-01T00:00:00.000Z')
  })
})
