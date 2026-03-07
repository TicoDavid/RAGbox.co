/**
 * useMercuryEntitlement — checks if the current user has Mercury access.
 *
 * During beta: always returns true (controlled by MERCURY_GATE_ENABLED env var).
 * At GA: flips to entitlements-based check via getEntitlements(tier).mercury_voice.
 */
import { useState, useEffect } from 'react'
import { getEntitlements, type BillingTier } from '@/lib/billing/entitlements'

const GATE_ENABLED = process.env.NEXT_PUBLIC_MERCURY_GATE_ENABLED === 'true'

export function useMercuryEntitlement() {
  const [tier, setTier] = useState<BillingTier | null>(null)
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

  // Beta: everyone gets Mercury
  if (!GATE_ENABLED) {
    return { hasMercury: true, tier, loading }
  }

  // GA: entitlements-based check
  const entitlements = tier ? getEntitlements(tier) : null
  const hasMercury = entitlements?.mercury_voice ?? false

  return { hasMercury, tier, loading }
}
