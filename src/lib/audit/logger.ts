/**
 * Veritas Audit Logger - RAGbox.co
 *
 * Immutable audit logging system for compliance-sensitive operations.
 * Logs to: Database (Prisma), Cloud Logging, BigQuery
 *
 * "The truth shall set you free, but first it must be logged."
 */

import { Logging, Log, Entry } from '@google-cloud/logging'
import { createAuditLog } from '@/lib/db'
import { insertAuditRow, type BigQueryAuditRow } from '@/lib/gcp/bigquery'
import {
  type AuditEvent,
  type AuditEventInput,
  type AuditAction,
  createAuditEvent,
  toBigQueryRow,
  hashQueryText,
} from './types'

// Configuration
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT
const LOG_NAME = 'ragbox-audit'

// Cloud Logging client singleton
let loggingClient: Logging | null = null
let auditLog: Log | null = null

/**
 * Get Cloud Logging client
 */
function getLoggingClient(): Logging {
  if (!loggingClient) {
    loggingClient = new Logging({ projectId: PROJECT_ID })
  }
  return loggingClient
}

/**
 * Get audit log instance
 */
function getAuditLog(): Log {
  if (!auditLog) {
    auditLog = getLoggingClient().log(LOG_NAME)
  }
  return auditLog
}

/**
 * Log to Cloud Logging
 */
async function logToCloudLogging(event: AuditEvent): Promise<void> {
  try {
    const log = getAuditLog()

    const metadata = {
      severity: mapSeverity(event.severity),
      resource: {
        type: 'global',
        labels: {
          project_id: PROJECT_ID || 'unknown',
        },
      },
      labels: {
        action: event.action,
        user_id: event.userId || 'system',
        event_id: event.eventId,
      },
    }

    const entry: Entry = log.entry(metadata, {
      eventId: event.eventId,
      timestamp: event.timestamp,
      userId: event.userId,
      action: event.action,
      resourceId: event.resourceId,
      resourceType: event.resourceType,
      severity: event.severity,
      detailsHash: event.detailsHash,
      ipAddress: event.ipAddress,
      // Note: Full details are in BigQuery, not Cloud Logging (privacy)
    })

    await log.write(entry)
  } catch (error) {
    // Don't fail the operation if logging fails
    console.error('Cloud Logging failed:', error)
  }
}

/**
 * Map severity to Cloud Logging severity
 */
function mapSeverity(severity: string): string {
  switch (severity) {
    case 'CRITICAL':
      return 'CRITICAL'
    case 'ERROR':
      return 'ERROR'
    case 'WARNING':
      return 'WARNING'
    default:
      return 'INFO'
  }
}

/**
 * Log to BigQuery
 */
async function logToBigQuery(event: AuditEvent): Promise<void> {
  try {
    const row = toBigQueryRow(event)
    await insertAuditRow(row)
  } catch (error) {
    // Don't fail the operation if BigQuery fails
    console.error('BigQuery logging failed:', error)
  }
}

/**
 * Log to database (Prisma)
 */
async function logToDatabase(event: AuditEvent): Promise<void> {
  try {
    await createAuditLog({
      userId: event.userId || undefined,
      action: event.action as Parameters<typeof createAuditLog>[0]['action'],
      resourceId: event.resourceId,
      resourceType: event.resourceType,
      details: event.details,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
    })
  } catch (error) {
    // Don't fail the operation if database logging fails
    console.error('Database logging failed:', error)
  }
}

/**
 * Main audit logging function
 *
 * Logs to all three destinations:
 * 1. Database (Prisma) - for quick queries
 * 2. Cloud Logging - for real-time monitoring
 * 3. BigQuery - for long-term storage and analytics
 *
 * @param input - Audit event input
 * @returns Created audit event
 */
export async function logAuditEvent(input: AuditEventInput): Promise<AuditEvent> {
  const event = createAuditEvent(input)

  // Log to all destinations in parallel
  await Promise.allSettled([
    logToDatabase(event),
    logToCloudLogging(event),
    logToBigQuery(event),
  ])

  return event
}

/**
 * Convenience function: Log login event
 */
export async function logLogin(
  userId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<AuditEvent> {
  return logAuditEvent({
    userId,
    action: 'LOGIN',
    details: { method: 'firebase' },
    ipAddress,
    userAgent,
  })
}

/**
 * Convenience function: Log logout event
 */
export async function logLogout(
  userId: string,
  ipAddress?: string
): Promise<AuditEvent> {
  return logAuditEvent({
    userId,
    action: 'LOGOUT',
    ipAddress,
  })
}

/**
 * Convenience function: Log document upload
 */
export async function logDocumentUpload(
  userId: string,
  documentId: string,
  filename: string,
  size: number,
  ipAddress?: string
): Promise<AuditEvent> {
  return logAuditEvent({
    userId,
    action: 'DOCUMENT_UPLOAD',
    resourceId: documentId,
    resourceType: 'document',
    details: {
      filename,
      size,
      uploadedAt: new Date().toISOString(),
    },
    ipAddress,
  })
}

/**
 * Convenience function: Log document delete
 */
export async function logDocumentDelete(
  userId: string,
  documentId: string,
  filename: string,
  ipAddress?: string
): Promise<AuditEvent> {
  return logAuditEvent({
    userId,
    action: 'DOCUMENT_DELETE',
    resourceId: documentId,
    resourceType: 'document',
    severity: 'WARNING',
    details: {
      filename,
      deletedAt: new Date().toISOString(),
    },
    ipAddress,
  })
}

/**
 * Convenience function: Log query submitted
 */
export async function logQuerySubmitted(
  userId: string,
  queryId: string,
  queryText: string,
  privilegeMode: boolean,
  ipAddress?: string
): Promise<AuditEvent> {
  return logAuditEvent({
    userId,
    action: 'QUERY_SUBMITTED',
    resourceId: queryId,
    resourceType: 'query',
    details: {
      queryHash: hashQueryText(queryText),
      queryLength: queryText.length,
      privilegeMode,
    },
    ipAddress,
  })
}

/**
 * Convenience function: Log query response
 */
export async function logQueryResponse(
  userId: string,
  queryId: string,
  queryText: string,
  responseText: string,
  confidence: number,
  silenceProtocol: boolean,
  chunksUsed: number,
  latencyMs: number,
  model: string,
  ipAddress?: string
): Promise<AuditEvent> {
  return logAuditEvent({
    userId,
    action: 'QUERY_RESPONSE',
    resourceId: queryId,
    resourceType: 'query',
    details: {
      queryHash: hashQueryText(queryText),
      responseHash: hashQueryText(responseText),
      confidence,
      silenceProtocol,
      chunksUsed,
      latencyMs,
      model,
    },
    ipAddress,
  })
}

/**
 * Convenience function: Log Silence Protocol triggered
 */
export async function logSilenceProtocol(
  userId: string,
  queryId: string,
  queryText: string,
  confidence: number,
  reason: string,
  ipAddress?: string
): Promise<AuditEvent> {
  return logAuditEvent({
    userId,
    action: 'SILENCE_PROTOCOL_TRIGGERED',
    resourceId: queryId,
    resourceType: 'query',
    severity: 'WARNING',
    details: {
      queryHash: hashQueryText(queryText),
      confidence,
      reason,
      threshold: 0.85,
    },
    ipAddress,
  })
}

/**
 * Convenience function: Log privilege mode change
 */
export async function logPrivilegeModeChange(
  userId: string,
  enabled: boolean,
  ipAddress?: string
): Promise<AuditEvent> {
  return logAuditEvent({
    userId,
    action: 'PRIVILEGE_MODE_CHANGE',
    severity: 'WARNING',
    details: {
      enabled,
      changedAt: new Date().toISOString(),
    },
    ipAddress,
  })
}

/**
 * Convenience function: Log document privilege change
 */
export async function logDocumentPrivilegeChange(
  userId: string,
  documentId: string,
  filename: string,
  isPrivileged: boolean,
  ipAddress?: string
): Promise<AuditEvent> {
  return logAuditEvent({
    userId,
    action: 'DOCUMENT_PRIVILEGE_CHANGE',
    resourceId: documentId,
    resourceType: 'document',
    severity: 'WARNING',
    details: {
      filename,
      isPrivileged,
      changedAt: new Date().toISOString(),
    },
    ipAddress,
  })
}

/**
 * Convenience function: Log data export
 */
export async function logDataExport(
  userId: string,
  exportType: 'full' | 'documents' | 'audit',
  ipAddress?: string
): Promise<AuditEvent> {
  return logAuditEvent({
    userId,
    action: 'DATA_EXPORT',
    severity: 'WARNING',
    details: {
      exportType,
      exportedAt: new Date().toISOString(),
    },
    ipAddress,
  })
}

/**
 * Convenience function: Log error
 */
export async function logError(
  userId: string | null,
  error: Error,
  context: string,
  ipAddress?: string
): Promise<AuditEvent> {
  return logAuditEvent({
    userId,
    action: 'ERROR',
    severity: 'ERROR',
    details: {
      errorName: error.name,
      errorMessage: error.message,
      context,
      stack: error.stack?.substring(0, 500), // Truncate stack trace
    },
    ipAddress,
  })
}

// Re-export types
export type { AuditEvent, AuditEventInput, AuditAction } from './types'
