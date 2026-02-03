/**
 * Security Tier System - RAGbox.co
 *
 * 5-Tier security classification with promotion/demotion rules.
 */

import { SecurityTier, type TierConfig, type TierRule } from '@/types/security'

export const TIER_CONFIGS: Record<SecurityTier, TierConfig> = {
  [SecurityTier.DropZone]: {
    tier: SecurityTier.DropZone,
    label: 'Drop Zone',
    description: 'Unverified upload, not yet indexed',
    color: '#666666',
    glowColor: 'rgba(102, 102, 102, 0.3)',
    icon: 'upload',
    isQueryable: false,
    requiresPrivilege: false,
  },
  [SecurityTier.Standard]: {
    tier: SecurityTier.Standard,
    label: 'Standard',
    description: 'Indexed and queryable',
    color: '#2463EB',
    glowColor: 'rgba(36, 99, 235, 0.3)',
    icon: 'file-text',
    isQueryable: true,
    requiresPrivilege: false,
  },
  [SecurityTier.Sensitive]: {
    tier: SecurityTier.Sensitive,
    label: 'Sensitive',
    description: 'Restricted access, queryable',
    color: '#3B82F6',
    glowColor: 'rgba(59, 130, 246, 0.3)',
    icon: 'shield',
    isQueryable: true,
    requiresPrivilege: false,
  },
  [SecurityTier.Confidential]: {
    tier: SecurityTier.Confidential,
    label: 'Confidential',
    description: 'Locked vault, queryable with caution',
    color: '#FFAB00',
    glowColor: 'rgba(255, 171, 0, 0.3)',
    icon: 'lock',
    isQueryable: true,
    requiresPrivilege: false,
  },
  [SecurityTier.Privileged]: {
    tier: SecurityTier.Privileged,
    label: 'Privileged',
    description: 'Attorney-client privilege, requires privilege mode',
    color: '#FF3D00',
    glowColor: 'rgba(255, 61, 0, 0.5)',
    icon: 'shield-alert',
    isQueryable: true,
    requiresPrivilege: true,
  },
}

export const TIER_RULES: Record<SecurityTier, TierRule> = {
  [SecurityTier.DropZone]: {
    canPromoteTo: [SecurityTier.Standard],
    canDemoteTo: [],
    autoPromoteAfterIndex: true,
  },
  [SecurityTier.Standard]: {
    canPromoteTo: [SecurityTier.Sensitive, SecurityTier.Confidential],
    canDemoteTo: [SecurityTier.DropZone],
    autoPromoteAfterIndex: false,
  },
  [SecurityTier.Sensitive]: {
    canPromoteTo: [SecurityTier.Confidential, SecurityTier.Privileged],
    canDemoteTo: [SecurityTier.Standard],
    autoPromoteAfterIndex: false,
  },
  [SecurityTier.Confidential]: {
    canPromoteTo: [SecurityTier.Privileged],
    canDemoteTo: [SecurityTier.Sensitive],
    autoPromoteAfterIndex: false,
  },
  [SecurityTier.Privileged]: {
    canPromoteTo: [],
    canDemoteTo: [SecurityTier.Confidential],
    autoPromoteAfterIndex: false,
  },
}

/**
 * Check if a tier transition is allowed
 */
export function canPromote(currentTier: number, targetTier: number): boolean {
  const rules = TIER_RULES[currentTier as SecurityTier]
  if (!rules) return false
  return rules.canPromoteTo.includes(targetTier as SecurityTier)
}

export function canDemote(currentTier: number, targetTier: number): boolean {
  const rules = TIER_RULES[currentTier as SecurityTier]
  if (!rules) return false
  return rules.canDemoteTo.includes(targetTier as SecurityTier)
}

/**
 * Get the tier config for a given tier number
 */
export function getTierConfig(tier: number): TierConfig {
  return TIER_CONFIGS[tier as SecurityTier] || TIER_CONFIGS[SecurityTier.DropZone]
}

/**
 * Check if a document is queryable at a given tier
 */
export function isQueryable(tier: number, privilegeMode: boolean): boolean {
  const config = getTierConfig(tier)
  if (!config.isQueryable) return false
  if (config.requiresPrivilege && !privilegeMode) return false
  return true
}

/**
 * Get the maximum accessible tier based on privilege mode
 */
export function getMaxAccessibleTier(privilegeMode: boolean): number {
  return privilegeMode ? SecurityTier.Privileged : SecurityTier.Confidential
}
