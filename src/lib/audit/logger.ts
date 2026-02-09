/**
 * Veritas Audit Logger - RAGbox.co
 *
 * Immutable audit logging to BigQuery for compliance.
 * Non-fatal: Audit failures do not block user operations.
 */

import { BigQuery, Table } from '@google-cloud/bigquery'
import {
  type AuditEvent,
  type AuditEventInput,
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

// Lazy-initialized BigQuery client and state
let bigQueryClient: BigQuery | null = null
let tableInitialized = false
let tableInitFailed = false

function getBigQuery(): BigQuery {
  if (!bigQueryClient) {
    bigQueryClient = new BigQuery({ projectId: PROJECT_ID })
  }
  return bigQueryClient
}

// Schema for audit table
const AUDIT_TABLE_SCHEMA = [
  { name: 'event_id', type: 'STRING', mode: 'REQUIRED' as const },
  { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED' as const },
  { name: 'user_id', type: 'STRING', mode: 'NULLABLE' as const },
  { name: 'action', type: 'STRING', mode: 'REQUIRED' as const },
  { name: 'resource_id', type: 'STRING', mode: 'NULLABLE' as const },
  { name: 'resource_type', type: 'STRING', mode: 'NULLABLE' as const },
  { name: 'severity', type: 'STRING', mode: 'REQUIRED' as const },
  { name: 'details', type: 'STRING', mode: 'NULLABLE' as const },
  { name: 'details_hash', type: 'STRING', mode: 'REQUIRED' as const },
  { name: 'ip_address', type: 'STRING', mode: 'NULLABLE' as const },
  { name: 'user_agent', type: 'STRING', mode: 'NULLABLE' as const },
  { name: 'session_id', type: 'STRING', mode: 'NULLABLE' as const },
  { name: 'inserted_at', type: 'TIMESTAMP', mode: 'REQUIRED' as const },
]

/**
 * Ensure BigQuery dataset and table exist (lazy init)
 */
async function ensureTableExists(): Promise<boolean> {
  if (tableInitialized) return !tableInitFailed
  if (tableInitFailed) return false

  try {
    const client = getBigQuery()
    const dataset = client.dataset(DATASET_ID)

    // Check/create dataset
    const [datasetExists] = await dataset.exists()
    if (!datasetExists) {
      await client.createDataset(DATASET_ID, { location: 'US' })
      console.log(`[Veritas] Created dataset: ${DATASET_ID}`)
    }

    // Check/create table
    const table = dataset.table(TABLE_ID)
    const [tableExists] = await table.exists()
    if (!tableExists) {
      await dataset.createTable(TABLE_ID, {
        schema: AUDIT_TABLE_SCHEMA,
        timePartitioning: {
          type: 'DAY',
          field: 'timestamp',
        },
      })
      console.log(`[Veritas] Created table: ${DATASET_ID}.${TABLE_ID}`)
    }

    tableInitialized = true
    return true
  } catch (error) {
    console.warn('[Veritas] BigQuery table init failed (audit writes disabled):', error)
    tableInitialized = true
    tableInitFailed = true
    return false
  }
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
    // Ensure table exists before inserting
    const ready = await ensureTableExists()
    if (!ready) {
      console.log(`[Veritas] Skipped (BQ unavailable): ${event.action}`)
      return null
    }

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
  fileSize?: number,
  ip?: string
): Promise<AuditEvent | null> {
  return logAuditEvent({
    userId,
    action: 'DOCUMENT_UPLOAD',
    severity: 'INFO',
    resourceId: documentId,
    resourceType: 'document',
    details: {
      documentId,
      filename,
      fileSize,
    },
    ip,
  })
}

/**
 * Log document deletion
 */
export async function logDocumentDelete(
  userId: string,
  documentId: string,
  filename: string,
  ip?: string
): Promise<AuditEvent | null> {
  return logAuditEvent({
    userId,
    action: 'DOCUMENT_DELETE',
    severity: 'WARNING',
    resourceId: documentId,
    resourceType: 'document',
    details: { documentId, filename },
    ip,
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
  ip?: string
): Promise<AuditEvent | null> {
  return logAuditEvent({
    userId,
    action: 'PRIVILEGE_MODE_CHANGE',
    severity: enabled ? 'CRITICAL' : 'INFO',
    details: { enabled },
    ip,
  })
}

/**
 * Log document privilege change
 */
export async function logDocumentPrivilegeChange(
  userId: string,
  documentId: string,
  filename: string,
  isPrivileged: boolean,
  ip?: string
): Promise<AuditEvent | null> {
  return logAuditEvent({
    userId,
    action: 'DOCUMENT_PRIVILEGE_CHANGE',
    severity: 'WARNING',
    resourceId: documentId,
    resourceType: 'document',
    details: { documentId, filename, isPrivileged },
    ip,
  })
}

/**
 * Log data export
 */
export async function logDataExport(
  userId: string,
  exportType: string,
  recordCount: number,
  ip?: string
): Promise<AuditEvent | null> {
  return logAuditEvent({
    userId,
    action: 'DATA_EXPORT',
    severity: 'WARNING',
    details: { exportType, recordCount },
    ip,
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
