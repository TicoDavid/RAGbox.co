/**
 * Veritas Audit Types - RAGbox.co
 *
 * Pure type definitions for the audit logging system.
 * Safe for client-side imports (no Node.js built-in dependencies).
 */

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
