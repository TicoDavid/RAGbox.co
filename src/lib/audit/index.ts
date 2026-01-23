/**
 * Audit Module Exports - RAGbox.co
 *
 * Veritas audit logging system for compliance.
 */

// Main logger
export {
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
} from './logger'

// Types
export {
  type AuditEvent,
  type AuditEventInput,
  type AuditAction,
  type AuditSeverity,
  type BigQueryAuditRow,
  type QueryAuditDetails,
  generateEventId,
  hashDetails,
  hashQueryText,
  createAuditEvent,
  toBigQueryRow,
  validateEventIntegrity,
  createQueryAuditDetails,
} from './types'
