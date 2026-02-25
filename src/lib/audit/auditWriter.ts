/**
 * Audit Writer — Hash-Chained, Tamper-Evident Audit Log
 *
 * Every entry's hash includes the previous entry's hash,
 * creating an immutable chain (SEC 17a-4 WORM-compatible).
 */

import { createHash } from 'crypto'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * Write a hash-chained audit entry.
 */
export async function writeAuditEntry(
  userId: string,
  action: string,
  resourceId?: string | null,
  details?: Record<string, unknown> | null,
  ipAddress?: string | null,
) {
  try {
    // Get the latest entry's hash for chain continuity
    const latest = await prisma.auditEntry.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { entryHash: true },
    })

    const previousHash = latest?.entryHash ?? 'GENESIS'
    const now = new Date()
    const detailsJson = details ? JSON.stringify(details) : ''

    // Compute hash: SHA-256(previousHash + action + resourceId + details + timestamp)
    const hashInput = `${previousHash}|${action}|${resourceId ?? ''}|${detailsJson}|${now.toISOString()}`
    const entryHash = createHash('sha256').update(hashInput, 'utf8').digest('hex')

    return await prisma.auditEntry.create({
      data: {
        userId,
        action,
        resourceId: resourceId ?? undefined,
        details: details ? (details as Prisma.InputJsonValue) : undefined,
        ipAddress: ipAddress ?? undefined,
        previousHash,
        entryHash,
      },
    })
  } catch (error) {
    logger.error('[Audit Writer] Failed to write entry:', error)
    // Non-fatal — don't break the calling operation
    return null
  }
}

/**
 * Verify the integrity of the audit chain.
 */
export async function verifyAuditChain(limit = 1000): Promise<{
  valid: boolean
  entries: number
  brokenAt?: string
}> {
  const entries = await prisma.auditEntry.findMany({
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: {
      id: true,
      action: true,
      resourceId: true,
      details: true,
      previousHash: true,
      entryHash: true,
      createdAt: true,
    },
  })

  if (entries.length === 0) {
    return { valid: true, entries: 0 }
  }

  let expectedPreviousHash = 'GENESIS'

  for (const entry of entries) {
    // Verify chain link
    if (entry.previousHash !== expectedPreviousHash) {
      return { valid: false, entries: entries.length, brokenAt: entry.id }
    }

    // Recompute hash
    const detailsJson = entry.details ? JSON.stringify(entry.details) : ''
    const hashInput = `${entry.previousHash}|${entry.action}|${entry.resourceId ?? ''}|${detailsJson}|${entry.createdAt.toISOString()}`
    const recomputedHash = createHash('sha256').update(hashInput, 'utf8').digest('hex')

    if (recomputedHash !== entry.entryHash) {
      return { valid: false, entries: entries.length, brokenAt: entry.id }
    }

    expectedPreviousHash = entry.entryHash
  }

  return { valid: true, entries: entries.length }
}
