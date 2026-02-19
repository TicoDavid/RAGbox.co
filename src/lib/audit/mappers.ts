/**
 * Audit Mappers - RAGbox.co
 *
 * Converts Prisma AuditEntry rows to AuditEvent interface
 * used by pdfExport.ts and csvExport.ts.
 */

import type { AuditAction, AuditSeverity, AuditEvent } from './audit-types'

/** Shape returned by Prisma auditEntry queries */
export interface PrismaAuditRow {
  id: string
  userId: string
  action: string
  resourceId: string | null
  severity: string
  details: unknown
  ipAddress: string | null
  userAgent: string | null
  entryHash: string
  createdAt: Date
}

/**
 * Map a Prisma AuditEntry row to the AuditEvent interface
 * consumed by export generators.
 */
export function mapPrismaToAuditEvent(row: PrismaAuditRow): AuditEvent {
  const details =
    row.details != null && typeof row.details === 'object'
      ? (row.details as Record<string, unknown>)
      : {}

  const timestamp = row.createdAt.toISOString()

  return {
    id: row.id,
    eventId: row.id,
    timestamp,
    userId: row.userId,
    action: row.action as AuditAction,
    severity: (row.severity ?? 'INFO') as AuditSeverity,
    details,
    hash: row.entryHash,
    detailsHash: row.entryHash,
    resourceId: row.resourceId ?? undefined,
    ip: row.ipAddress ?? undefined,
    ipAddress: row.ipAddress ?? undefined,
    userAgent: row.userAgent ?? undefined,
  }
}
