import { useState, useEffect } from 'react'

export type SubscriptionTier = 'free' | 'starter' | 'professional' | 'enterprise' | 'sovereign' | null

export function useSubscriptionTier() {
  const [tier, setTier] = useState<SubscriptionTier>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/user/profile', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => {
        setTier((json.data?.subscriptionTier as SubscriptionTier) || null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const isStarter = tier === 'starter' || tier === 'free'
  const hasVoice = tier === 'professional' || tier === 'enterprise' || tier === 'sovereign'
  const hasAllChannels = tier === 'enterprise'

  return { tier, loading, isStarter, hasVoice, hasAllChannels }
}
