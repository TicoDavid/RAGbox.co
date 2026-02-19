/**
 * Audit CSV Export - RAGbox.co
 *
 * Generates a CSV buffer from AuditEvent[] for compliance downloads.
 */

import type { AuditEvent } from './audit-types'

const HEADERS = [
  'Event ID',
  'Timestamp',
  'User ID',
  'Action',
  'Severity',
  'Resource ID',
  'IP Address',
  'Details',
  'Hash',
]

/** Escape a value for CSV (RFC 4180) */
function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Generate a CSV buffer from an array of audit events.
 */
export function generateCsvBuffer(events: AuditEvent[]): Buffer {
  const rows: string[] = [HEADERS.join(',')]

  for (const e of events) {
    const detailsStr = JSON.stringify(e.details ?? {})
    const row = [
      e.eventId,
      e.timestamp,
      e.userId,
      e.action,
      e.severity,
      e.resourceId ?? '',
      e.ipAddress ?? '',
      detailsStr,
      e.detailsHash,
    ].map(escapeCsv)

    rows.push(row.join(','))
  }

  return Buffer.from(rows.join('\n'), 'utf-8')
}
