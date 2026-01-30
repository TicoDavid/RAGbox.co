/**
 * Database Layer - RAGbox.co
 *
 * Provides Prisma-backed audit log operations.
 * Replaces the previous in-memory stub.
 */

import prisma from '@/lib/prisma'
import type { AuditAction } from '@/types/models'

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
 */
export async function createAuditLog(input: CreateAuditLogInput): Promise<AuditLogEntry> {
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
  } catch (error) {
    // Fallback: log to console if DB is unavailable
    console.error('Database audit log failed, logging to console:', error)
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
  } catch (error) {
    console.error('Database audit query failed:', error)
    return []
  }
}

export { prisma }

export default {
  createAuditLog,
  getAuditLogs,
  prisma,
}
