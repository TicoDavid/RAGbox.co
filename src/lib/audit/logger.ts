/**
 * Veritas Audit Logger - RAGbox.co
 *
 * Immutable audit logging to BigQuery for compliance.
 * Non-fatal: Audit failures do not block user operations.
 */

import { BigQuery } from '@google-cloud/bigquery'
import {
  type AuditEvent,
  type AuditEventInput,
  type AuditAction,
  type AuditSeverity,
  createAuditEvent,
  toBigQueryRow,
  createQueryAuditDetails,
} from './types'

// ============================================================================
// CONFIGURATION
// ============================================================================

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'ragbox-sovereign-prod'
const DATASET_ID = process.env.BIGQUERY_DATASET || 'ragbox_audit'
const TABLE_ID = process.env.BIGQUERY_TABLE || 'audit_log'

// Lazy-initialized BigQuery client
let bigQueryClient: BigQuery | null = null

function getBigQuery(): BigQuery {
  if (!bigQueryClient) {
    bigQueryClient = new BigQuery({ projectId: PROJECT_ID })
  }
  return bigQueryClient
}

// ============================================================================
// CORE LOGGING FUNCTION
// ============================================================================

/**
 * Log an audit event to BigQuery
 * Non-fatal: errors are logged but do not throw
 */
export async function logAuditEvent(input: AuditEventInput): Promise<AuditEvent | null> {
  const event = createAuditEvent(input)

  try {
    const row = toBigQueryRow(event)
    await getBigQuery()
      .dataset(DATASET_ID)
      .table(TABLE_ID)
      .insert([row])

    console.log(`[Veritas] Logged: ${event.action} by ${event.userId}`)
    return event
  } catch (error) {
    // Non-fatal: log error but don't block the operation
    console.error('[Veritas] Audit log failed (non-fatal):', error)
    return null
  }
}

// ============================================================================
// CONVENIENCE LOGGING FUNCTIONS
// ============================================================================

/**
 * Log user login
 */
export async function logLogin(
  userId: string,
  options?: { ip?: string; userAgent?: string; method?: string }
): Promise<AuditEvent | null> {
  return logAuditEvent({
    userId,
    action: 'LOGIN',
    severity: 'INFO',
    details: { method: options?.method || 'oauth' },
    ip: options?.ip,
    userAgent: options?.userAgent,
  })
}

/**
 * Log user logout
 */
export async function logLogout(
  userId: string,
  options?: { ip?: string; sessionDuration?: number }
): Promise<AuditEvent | null> {
  return logAuditEvent({
    userId,
    action: 'LOGOUT',
    severity: 'INFO',
    details: { sessionDuration: options?.sessionDuration },
    ip: options?.ip,
  })
}

/**
 * Log document upload
 */
export async function logDocumentUpload(
  userId: string,
  documentId: string,
  filename: string,
  options?: { fileSize?: number; mimeType?: string; securityTier?: number }
): Promise<AuditEvent | null> {
  return logAuditEvent({
    userId,
    action: 'DOCUMENT_UPLOAD',
    severity: 'INFO',
    details: {
      documentId,
      filename,
      fileSize: options?.fileSize,
      mimeType: options?.mimeType,
      securityTier: options?.securityTier || 0,
    },
  })
}

/**
 * Log document deletion
 */
export async function logDocumentDelete(
  userId: string,
  documentId: string,
  filename: string
): Promise<AuditEvent | null> {
  return logAuditEvent({
    userId,
    action: 'DOCUMENT_DELETE',
    severity: 'WARNING',
    details: { documentId, filename },
  })
}

/**
 * Log query submission
 */
export async function logQuerySubmitted(
  userId: string,
  query: string,
  documentIds: string[],
  privilegeMode: boolean
): Promise<AuditEvent | null> {
  const details = createQueryAuditDetails(query, documentIds, privilegeMode)
  return logAuditEvent({
    userId,
    action: 'QUERY_SUBMITTED',
    severity: 'INFO',
    details: details as unknown as Record<string, unknown>,
  })
}

/**
 * Log query response
 */
export async function logQueryResponse(
  userId: string,
  query: string,
  documentIds: string[],
  privilegeMode: boolean,
  options: { confidence: number; responseTime: number; model?: string }
): Promise<AuditEvent | null> {
  const details = createQueryAuditDetails(query, documentIds, privilegeMode, options)
  return logAuditEvent({
    userId,
    action: 'QUERY_RESPONSE',
    severity: 'INFO',
    details: details as unknown as Record<string, unknown>,
  })
}

/**
 * Log Silence Protocol activation
 */
export async function logSilenceProtocol(
  userId: string,
  query: string,
  confidence: number,
  threshold: number
): Promise<AuditEvent | null> {
  return logAuditEvent({
    userId,
    action: 'SILENCE_PROTOCOL',
    severity: 'WARNING',
    details: {
      queryExcerpt: query.slice(0, 100),
      confidence,
      threshold,
      reason: 'Confidence below threshold',
    },
  })
}

/**
 * Log privilege mode change
 */
export async function logPrivilegeModeChange(
  userId: string,
  enabled: boolean,
  options?: { reason?: string }
): Promise<AuditEvent | null> {
  return logAuditEvent({
    userId,
    action: 'PRIVILEGE_MODE_CHANGE',
    severity: enabled ? 'CRITICAL' : 'INFO',
    details: {
      enabled,
      reason: options?.reason,
    },
  })
}

/**
 * Log document privilege change
 */
export async function logDocumentPrivilegeChange(
  userId: string,
  documentId: string,
  isPrivileged: boolean
): Promise<AuditEvent | null> {
  return logAuditEvent({
    userId,
    action: 'DOCUMENT_PRIVILEGE_CHANGE',
    severity: 'WARNING',
    details: { documentId, isPrivileged },
  })
}

/**
 * Log data export
 */
export async function logDataExport(
  userId: string,
  exportType: 'pdf' | 'csv' | 'json',
  recordCount: number
): Promise<AuditEvent | null> {
  return logAuditEvent({
    userId,
    action: 'DATA_EXPORT',
    severity: 'WARNING',
    details: { exportType, recordCount },
  })
}

/**
 * Log error
 */
export async function logError(
  userId: string,
  error: Error | string,
  context?: Record<string, unknown>
): Promise<AuditEvent | null> {
  return logAuditEvent({
    userId,
    action: 'ERROR',
    severity: 'ERROR',
    details: {
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack?.slice(0, 500) : undefined,
      ...context,
    },
  })
}

// Default export for backwards compatibility
export default {
  logAuditEvent,
  logLogin,
  logLogout,
  logDocumentUpload,
  logDocumentDelete,
  logQuerySubmitted,
  logQueryResponse,
  logSilenceProtocol,
  logPrivilegeModeChange,
  logDocumentPrivilegeChange,
  logDataExport,
  logError,
}
