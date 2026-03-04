/**
 * Audit Mappers - RAGbox.co
 *
 * Converts Prisma AuditEntry rows to AuditEvent interface
 * used by pdfExport.ts and csvExport.ts.
 */

import type { AuditAction, AuditSeverity, AuditEvent } from './audit-types'

// ── STORY-231: Model metadata keys that must be stripped from audit exports ──
const MODEL_METADATA_KEYS = ['modelUsed', 'provider', 'model'] as const

/**
 * Sanitize audit details for export: replace raw model names with
 * "AEGIS" (standard routes) or "Custom LLM" (BYOLLM routes).
 * CPO ruling: audit CSV/PDF exports must not leak raw model identifiers.
 */
export function sanitizeModelMetadata(
  details: Record<string, unknown>,
): Record<string, unknown> {
  const hasModelKey = MODEL_METADATA_KEYS.some((k) => k in details)
  if (!hasModelKey) return details

  const sanitized = { ...details }
  const provider = String(details.provider ?? '').toLowerCase()
  const isBYOLLM = provider === 'byollm' || provider === 'custom'
  const label = isBYOLLM ? 'Custom LLM' : 'AEGIS'

  for (const key of MODEL_METADATA_KEYS) {
    if (key in sanitized) {
      sanitized[key] = label
    }
  }
  return sanitized
}

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

  // STORY-231: Strip model metadata from export-facing details
  const safeDetails = sanitizeModelMetadata(details)

  return {
    id: row.id,
    eventId: row.id,
    timestamp,
    userId: row.userId,
    action: row.action as AuditAction,
    severity: (row.severity ?? 'INFO') as AuditSeverity,
    details: safeDetails,
    hash: row.entryHash,
    detailsHash: row.entryHash,
    resourceId: row.resourceId ?? undefined,
    ip: row.ipAddress ?? undefined,
    ipAddress: row.ipAddress ?? undefined,
    userAgent: row.userAgent ?? undefined,
  }
}
