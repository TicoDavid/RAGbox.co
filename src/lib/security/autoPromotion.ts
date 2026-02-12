/**
 * Auto-Promotion System - RAGbox.co
 *
 * Automatically promotes documents from Tier 0 (Drop Zone) to Tier 1 (Standard)
 * after successful indexing. Also handles stale drop zone cleanup.
 */

import prisma from '@/lib/prisma'
import { deletion_status, index_status } from '@prisma/client'
import { SecurityTier } from '@/types/security'

const STALE_DROP_ZONE_HOURS = 24

/**
 * Promote a document from Tier 0 to Tier 1 after successful indexing
 */
export async function promoteToTier1(documentId: string): Promise<boolean> {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { securityTier: true, indexStatus: true },
    })

    if (!doc) return false

    // Only promote from Tier 0 and only if indexed
    if (doc.securityTier !== SecurityTier.DropZone) return false
    if (doc.indexStatus !== 'Indexed') return false

    await prisma.document.update({
      where: { id: documentId },
      data: { securityTier: SecurityTier.Standard },
    })

    return true
  } catch {
    return false
  }
}

/**
 * Purge stale Drop Zone documents that haven't been indexed
 * within the configured time window
 */
export async function purgeStaleDropZone(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - STALE_DROP_ZONE_HOURS * 60 * 60 * 1000)

    const result = await prisma.document.updateMany({
      where: {
        securityTier: SecurityTier.DropZone,
        indexStatus: { in: [index_status.Pending, index_status.Failed] },
        createdAt: { lt: cutoff },
        deletionStatus: deletion_status.Active,
      },
      data: {
        deletionStatus: deletion_status.SoftDeleted,
        deletedAt: new Date(),
        hardDeleteAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    return result.count
  } catch {
    return 0
  }
}
