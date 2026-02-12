/**
 * Veritas Audit Types + Helpers - RAGbox.co
 *
 * Server-side audit helpers that depend on Node.js crypto.
 * For client-safe type imports, use '@/lib/audit/audit-types' directly.
 *
 * Re-exports all types from audit-types for backward compatibility.
 */

import crypto from 'crypto'

// Re-export all types so existing server-side imports continue to work
export type {
  AuditAction,
  AuditSeverity,
  AuditEvent,
  AuditEventInput,
  QueryAuditDetails,
  BigQueryAuditRow,
} from './audit-types'

import type { AuditEvent, AuditEventInput, QueryAuditDetails, BigQueryAuditRow } from './audit-types'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  return `audit_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
}

/**
 * Hash sensitive details for integrity verification
 */
export function hashDetails(details: Record<string, unknown>): string {
  const json = JSON.stringify(details, Object.keys(details).sort())
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 16)
}

/**
 * Hash query text for privacy while maintaining searchability
 */
export function hashQueryText(query: string): string {
  return crypto.createHash('sha256').update(query).digest('hex').slice(0, 16)
}

/**
 * Create a full audit event from input
 */
export function createAuditEvent(input: AuditEventInput): AuditEvent {
  const id = generateEventId()
  const timestamp = new Date().toISOString()
  const details = input.details || {}
  const hash = hashDetails({ id, timestamp, userId: input.userId, action: input.action, ...details })

  return {
    id,
    eventId: id, // Alias
    timestamp,
    userId: input.userId,
    action: input.action,
    severity: input.severity || 'INFO',
    details,
    hash,
    detailsHash: hash, // Alias
    resourceId: input.resourceId,
    resourceType: input.resourceType,
    sessionId: input.sessionId,
    ip: input.ip,
    ipAddress: input.ip, // Alias
    userAgent: input.userAgent,
  }
}

/**
 * Convert audit event to BigQuery row format
 */
export function toBigQueryRow(event: AuditEvent): BigQueryAuditRow {
  return {
    event_id: event.id,
    timestamp: event.timestamp,
    user_id: event.userId,
    action: event.action,
    severity: event.severity,
    resource_id: event.resourceId || null,
    resource_type: event.resourceType || null,
    details: JSON.stringify(event.details),
    details_hash: event.hash,
    session_id: event.sessionId || null,
    ip_address: event.ip || null,
    user_agent: event.userAgent || null,
    inserted_at: new Date().toISOString(),
  }
}

/**
 * Validate event integrity by recomputing hash
 */
export function validateEventIntegrity(event: AuditEvent): boolean {
  const recomputedHash = hashDetails({
    id: event.id,
    timestamp: event.timestamp,
    userId: event.userId,
    action: event.action,
    ...event.details,
  })
  return recomputedHash === event.hash
}

/**
 * Create query audit details with privacy protection
 */
export function createQueryAuditDetails(
  query: string,
  documentIds: string[],
  privilegeMode: boolean,
  options?: Partial<QueryAuditDetails>
): QueryAuditDetails {
  return {
    query: query.slice(0, 200), // Truncate for storage
    queryHash: hashQueryText(query),
    documentCount: documentIds.length,
    documentIds: documentIds.slice(0, 10), // Limit stored IDs
    privilegeMode,
    ...options,
  }
}
