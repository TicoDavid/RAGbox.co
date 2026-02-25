/**
 * Database Layer - RAGbox.co
 *
 * Provides Prisma-backed audit log operations.
 * Replaces the previous in-memory stub.
 */

import prisma from '@/lib/prisma'
import type { AuditAction } from '@/types/models'
import { logger } from '@/lib/logger'

export type { AuditAction } from '@/types/models'

export interface AuditLogEntry {
  id: string
  userId?: string
  action: AuditAction
  resourceId?: string
  resourceType?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  createdAt: Date
}

export interface CreateAuditLogInput {
  userId?: string
  action: AuditAction
  resourceId?: string
  resourceType?: string
  details?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

/**
 * Create an audit log entry via Prisma
 * @deprecated AuditLog is frozen. Route new audit writes to Go backend (AuditEntry).
 */
export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLogEntry> {
  logger.warn('DEPRECATED: AuditLog is frozen. Route new audit writes to Go backend AuditEntry.')
  try {
    const entry = await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        resourceId: input.resourceId ?? null,
        resourceType: input.resourceType ?? null,
        severity: 'INFO',
        details: input.details ? JSON.parse(JSON.stringify(input.details)) : undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    })

    return {
      id: entry.id,
      userId: entry.userId ?? undefined,
      action: entry.action as AuditAction,
      resourceId: entry.resourceId ?? undefined,
      resourceType: entry.resourceType ?? undefined,
      details: entry.details as Record<string, unknown> | undefined,
      ipAddress: entry.ipAddress ?? undefined,
      userAgent: entry.userAgent ?? undefined,
      createdAt: entry.createdAt,
    }
  } catch {
    // Fallback: return in-memory entry if DB is unavailable
    const fallbackEntry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      ...input,
      createdAt: new Date(),
    }
    return fallbackEntry
  }
}

/**
 * Get audit logs via Prisma
 */
export async function getAuditLogs(
  userId?: string,
  limit: number = 100
): Promise<AuditLogEntry[]> {
  try {
    const logs = await prisma.auditLog.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    return logs.map((entry): AuditLogEntry => ({
      id: entry.id,
      userId: entry.userId ?? undefined,
      action: entry.action as AuditAction,
      resourceId: entry.resourceId ?? undefined,
      resourceType: entry.resourceType ?? undefined,
      details: entry.details as Record<string, unknown> | undefined,
      ipAddress: entry.ipAddress ?? undefined,
      userAgent: entry.userAgent ?? undefined,
      createdAt: entry.createdAt,
    }))
  } catch {
    return []
  }
}

export { prisma }

export default {
  createAuditLog,
  getAuditLogs,
  prisma,
}
