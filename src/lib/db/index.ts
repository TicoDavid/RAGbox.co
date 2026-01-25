/**
 * Database Stub - RAGbox.co
 *
 * Placeholder for Prisma database operations.
 * TODO: Connect to real database when Prisma schema is configured.
 */

// In-memory store for audit logs (demo purposes)
const auditLogStore: AuditLogEntry[] = [];

export interface AuditLogEntry {
  id: string;
  userId?: string;
  action: AuditAction;
  resourceId?: string;
  resourceType?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_DELETE'
  | 'DOCUMENT_VIEW'
  | 'QUERY_SUBMITTED'
  | 'QUERY_RESPONSE'
  | 'SILENCE_PROTOCOL_TRIGGERED'
  | 'PRIVILEGE_MODE_CHANGE'
  | 'DOCUMENT_PRIVILEGE_CHANGE'
  | 'DATA_EXPORT'
  | 'ERROR';

export interface CreateAuditLogInput {
  userId?: string;
  action: AuditAction;
  resourceId?: string;
  resourceType?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create an audit log entry (in-memory stub)
 */
export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLogEntry> {
  const entry: AuditLogEntry = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    ...input,
    createdAt: new Date(),
  };

  auditLogStore.push(entry);

  // Keep only last 1000 entries in memory
  if (auditLogStore.length > 1000) {
    auditLogStore.shift();
  }

  return entry;
}

/**
 * Get audit logs (in-memory stub)
 */
export async function getAuditLogs(
  userId?: string,
  limit: number = 100
): Promise<AuditLogEntry[]> {
  let logs = [...auditLogStore];

  if (userId) {
    logs = logs.filter(log => log.userId === userId);
  }

  return logs
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

/**
 * Prisma client stub - returns null until Prisma is configured
 */
export const prisma = null;

export default {
  createAuditLog,
  getAuditLogs,
  prisma,
};
