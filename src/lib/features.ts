/**
 * Feature flags for gating paid features.
 *
 * Phase 1 (beta): env-var flag, default true — everyone gets Mercury.
 * Phase 2: subscription tier check (user.subscription.tier >= 'team').
 */

export function isMercuryEnabled(): boolean {
  // Phase 1: feature flag (beta = everyone gets it)
  const flag = process.env.NEXT_PUBLIC_MERCURY_ENABLED
  if (flag === 'false') return false

  // Phase 2: subscription tier check (uncomment when billing ships)
  // return user.subscription?.tier >= 'team'

  return true // beta default
}
