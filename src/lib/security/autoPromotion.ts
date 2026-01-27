/**
 * Auto-Promotion System - RAGbox.co
 *
 * Automatically promotes documents from Tier 0 (Drop Zone) to Tier 1 (Standard)
 * after successful indexing. Also handles stale drop zone cleanup.
 */

import prisma from '@/lib/prisma'
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

    console.log(`[AutoPromotion] Document ${documentId} promoted to Tier 1 (Standard)`)
    return true
  } catch (error) {
    console.error(`[AutoPromotion] Failed to promote document ${documentId}:`, error)
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
        indexStatus: { in: ['Pending', 'Failed'] },
        createdAt: { lt: cutoff },
        deletionStatus: 'Active',
      },
      data: {
        deletionStatus: 'SoftDeleted',
        deletedAt: new Date(),
        hardDeleteAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    if (result.count > 0) {
      console.log(`[AutoPromotion] Purged ${result.count} stale Drop Zone documents`)
    }

    return result.count
  } catch (error) {
    console.error('[AutoPromotion] Failed to purge stale drop zone:', error)
    return 0
  }
}
