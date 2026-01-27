/**
 * Tier-Based Query Filter - RAGbox.co
 *
 * Determines which documents are accessible based on security tier and privilege mode.
 */

import prisma from '@/lib/prisma'
import { getMaxAccessibleTier, isQueryable } from './tiers'

/**
 * Get document IDs accessible for querying based on tier + privilege
 */
export async function getAccessibleDocumentIds(
  userId: string,
  privilegeMode: boolean
): Promise<string[]> {
  const maxTier = getMaxAccessibleTier(privilegeMode)

  try {
    const documents = await prisma.document.findMany({
      where: {
        userId,
        deletionStatus: 'Active',
        indexStatus: 'Indexed',
        securityTier: { lte: maxTier },
      },
      select: { id: true, securityTier: true },
    })

    // Filter by queryability rules
    return documents
      .filter(doc => isQueryable(doc.securityTier, privilegeMode))
      .map(doc => doc.id)
  } catch (error) {
    console.error('[TierFilter] Failed to get accessible documents:', error)
    return []
  }
}

/**
 * Check if a specific document is accessible
 */
export async function isDocumentAccessible(
  documentId: string,
  userId: string,
  privilegeMode: boolean
): Promise<boolean> {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { userId: true, securityTier: true, deletionStatus: true, indexStatus: true },
    })

    if (!doc) return false
    if (doc.userId !== userId) return false
    if (doc.deletionStatus !== 'Active') return false
    if (doc.indexStatus !== 'Indexed') return false

    return isQueryable(doc.securityTier, privilegeMode)
  } catch (error) {
    console.error('[TierFilter] Access check failed:', error)
    return false
  }
}
