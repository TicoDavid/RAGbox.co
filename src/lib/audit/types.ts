/**
 * Veritas Audit Types - RAGbox.co
 *
 * Type definitions for the immutable audit logging system.
 */

import crypto from 'crypto'

// ============================================================================
// CORE TYPES
// ============================================================================

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_DELETE'
  | 'DOCUMENT_VIEW'
  | 'QUERY_SUBMITTED'
  | 'QUERY_RESPONSE'
  | 'SILENCE_PROTOCOL'
  | 'SILENCE_PROTOCOL_TRIGGERED'
  | 'PRIVILEGE_MODE_CHANGE'
  | 'DOCUMENT_PRIVILEGE_CHANGE'
  | 'DOCUMENT_TIER_CHANGE'
  | 'DATA_EXPORT'
  | 'SETTINGS_CHANGE'
  | 'ERROR'

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'ERROR'

export interface AuditEvent {
  id: string
  eventId: string // Alias for id (for compatibility)
  timestamp: string
  userId: string
  action: AuditAction
  severity: AuditSeverity
  details: Record<string, unknown>
  hash: string // SHA-256 hash for integrity verification
  detailsHash: string // Alias for hash (for compatibility)
  resourceId?: string
  resourceType?: string
  sessionId?: string
  ip?: string
  ipAddress?: string // Alias for ip (for compatibility)
  userAgent?: string
}

export interface AuditEventInput {
  userId: string
  action: AuditAction
  severity?: AuditSeverity
  details?: Record<string, unknown>
  resourceId?: string
  resourceType?: string
  sessionId?: string
  ip?: string
  userAgent?: string
}

export interface QueryAuditDetails {
  query: string
  queryHash: string
  documentCount: number
  documentIds: string[]
  privilegeMode: boolean
  confidence?: number
  silenceProtocol?: boolean
  responseTime?: number
  model?: string
}

export interface BigQueryAuditRow {
  event_id: string
  timestamp: string
  user_id: string
  action: string
  severity: string
  resource_id: string | null
  resource_type: string | null
  details: string
  details_hash: string
  session_id: string | null
  ip_address: string | null
  user_agent: string | null
  inserted_at: string
}

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
// TypeScript types for audit events

type AuditEvent = {
    id: string;
    userId: string;
    action: string;
    timestamp: Date;
    details?: string;
};

interface AuditLog {
    events: AuditEvent[];
    addEvent(event: AuditEvent): void;
    getEventsByUser(userId: string): AuditEvent[];
}

export { AuditEvent, AuditLog };
