/**
 * useEntitlements — checks the current user's subscription tier and returns
 * all entitlements plus per-feature gate helpers.
 *
 * During beta (NEXT_PUBLIC_GATE_ENABLED !== 'true'): all features are accessible,
 * but `isBeta` flag is true so the UI can show upgrade nudges instead of hard blocks.
 */
import { useState, useEffect } from 'react'
import {
  getEntitlements,
  type BillingTier,
  type Entitlements,
} from '@/lib/billing/entitlements'

const GATE_ENABLED = process.env.NEXT_PUBLIC_GATE_ENABLED === 'true'

interface UseEntitlementsReturn {
  tier: BillingTier
  entitlements: Entitlements
  loading: boolean
  isBeta: boolean
  /** Mercury voice = Enterprise+ (starter has it too per entitlements) */
  hasMercuryVoice: boolean
  /** BYOLLM = Professional+ */
  hasByollm: boolean
  /** Advanced RAG (API keys) = Professional+ */
  hasAdvancedRag: boolean
  /** Check if a specific feature is gated (returns false during beta) */
  isGated: (feature: keyof Entitlements) => boolean
}

export function useEntitlements(): UseEntitlementsReturn {
  const [tier, setTier] = useState<BillingTier>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user/profile', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        setTier((json.data?.subscriptionTier as BillingTier) || 'free')
      })
      .catch(() => setTier('free'))
      .finally(() => setLoading(false))
  }, [])

  const entitlements = getEntitlements(tier)
  const isBeta = !GATE_ENABLED

  const isGated = (feature: keyof Entitlements): boolean => {
    if (isBeta) return false
    const value = entitlements[feature]
    if (typeof value === 'boolean') return !value
    if (typeof value === 'number') return value === 0
    if (Array.isArray(value)) return value.length === 0
    return false
  }

  return {
    tier,
    entitlements,
    loading,
    isBeta,
    hasMercuryVoice: isBeta || entitlements.mercury_voice,
    hasByollm: isBeta || entitlements.byollm_enabled,
    hasAdvancedRag: isBeta || entitlements.api_keys_enabled,
    isGated,
  }
}
