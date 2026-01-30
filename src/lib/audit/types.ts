/**
 * Audit Types - RAGbox.co
 *
 * Type definitions for the Veritas audit logging system.
 * Supports immutable, WORM-compliant audit trails.
 */

import { createHash } from 'crypto'
import type { AuditAction, AuditSeverity } from '@/types/models'

export type { AuditAction, AuditSeverity } from '@/types/models'

/**
 * Core audit event structure
 */
export interface AuditEvent {
  /** Unique event ID */
  eventId: string
  /** ISO timestamp */
  timestamp: string
  /** User ID (null for system events) */
  userId: string | null
  /** Action type */
  action: AuditAction
  /** Affected resource ID */
  resourceId?: string
  /** Resource type (document, query, etc.) */
  resourceType?: string
  /** Event severity */
  severity: AuditSeverity
  /** Event details */
  details: Record<string, unknown>
  /** SHA-256 hash of details for verification */
  detailsHash: string
  /** Client IP address */
  ipAddress?: string
  /** User agent string */
  userAgent?: string
  /** Session ID */
  sessionId?: string
}

/**
 * BigQuery row format for audit events
 */
export interface BigQueryAuditRow {
  event_id: string
  timestamp: string
  user_id: string | null
  action: string
  resource_id: string | null
  resource_type: string | null
  severity: string
  details: string // JSON string
  details_hash: string
  ip_address: string | null
  user_agent: string | null
  session_id: string | null
  inserted_at: string
}

/**
 * Audit event input (before processing)
 */
export interface AuditEventInput {
  userId?: string | null
  action: AuditAction
  resourceId?: string
  resourceType?: string
  severity?: AuditSeverity
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  sessionId?: string
}

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `evt_${timestamp}_${random}`
}

/**
 * Calculate SHA-256 hash of details for verification
 */
export function hashDetails(details: Record<string, unknown>): string {
  const json = JSON.stringify(details, Object.keys(details).sort())
  return createHash('sha256').update(json).digest('hex')
}

/**
 * Create a full audit event from input
 */
export function createAuditEvent(input: AuditEventInput): AuditEvent {
  const details = input.details || {}

  return {
    eventId: generateEventId(),
    timestamp: new Date().toISOString(),
    userId: input.userId || null,
    action: input.action,
    resourceId: input.resourceId,
    resourceType: input.resourceType,
    severity: input.severity || getSeverityForAction(input.action),
    details,
    detailsHash: hashDetails(details),
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    sessionId: input.sessionId,
  }
}

/**
 * Get default severity for an action
 */
function getSeverityForAction(action: AuditAction): AuditSeverity {
  switch (action) {
    case 'ERROR':
      return 'ERROR'
    case 'SILENCE_PROTOCOL_TRIGGERED':
      return 'WARNING'
    case 'DOCUMENT_DELETE':
    case 'DOCUMENT_PRIVILEGE_CHANGE':
    case 'PRIVILEGE_MODE_CHANGE':
      return 'WARNING'
    default:
      return 'INFO'
  }
}

/**
 * Convert audit event to BigQuery row format
 */
export function toBigQueryRow(event: AuditEvent): BigQueryAuditRow {
  return {
    event_id: event.eventId,
    timestamp: event.timestamp,
    user_id: event.userId,
    action: event.action,
    resource_id: event.resourceId || null,
    resource_type: event.resourceType || null,
    severity: event.severity,
    details: JSON.stringify(event.details),
    details_hash: event.detailsHash,
    ip_address: event.ipAddress || null,
    user_agent: event.userAgent || null,
    session_id: event.sessionId || null,
    inserted_at: new Date().toISOString(),
  }
}

/**
 * Validate audit event integrity
 */
export function validateEventIntegrity(event: AuditEvent): boolean {
  const calculatedHash = hashDetails(event.details)
  return calculatedHash === event.detailsHash
}

/**
 * Query response audit details
 */
export interface QueryAuditDetails {
  queryText?: string
  queryHash: string
  responseHash?: string
  confidence?: number
  silenceProtocol?: boolean
  chunksUsed?: number
  latencyMs?: number
  model?: string
}

/**
 * Hash query text for audit (privacy-preserving)
 */
export function hashQueryText(query: string): string {
  return createHash('sha256').update(query).digest('hex').substring(0, 16)
}

/**
 * Create query audit details
 */
export function createQueryAuditDetails(
  query: string,
  response?: string,
  metadata?: Partial<QueryAuditDetails>
): QueryAuditDetails {
  return {
    queryHash: hashQueryText(query),
    responseHash: response ? hashQueryText(response) : undefined,
    ...metadata,
  }
}
