/**
 * Security Types - RAGbox.co
 *
 * 5-Tier Security Data Model for document classification.
 */

export enum SecurityTier {
  DropZone = 0,    // Tier 0: Unverified uploads
  Standard = 1,    // Tier 1: Indexed, queryable
  Sensitive = 2,   // Tier 2: Restricted access
  Confidential = 3, // Tier 3: Locked vault
  Privileged = 4,  // Tier 4: Attorney-client privilege
}

export interface TierConfig {
  tier: SecurityTier
  label: string
  description: string
  color: string
  glowColor: string
  icon: string
  isQueryable: boolean
  requiresPrivilege: boolean
}

export interface TierRule {
  canPromoteTo: SecurityTier[]
  canDemoteTo: SecurityTier[]
  autoPromoteAfterIndex: boolean
}
