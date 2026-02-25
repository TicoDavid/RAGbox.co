/**
 * useUserRole — lightweight hook to fetch the current user's role
 * from the existing /api/user/profile endpoint. Caches in state;
 * fetched once on mount.
 */

import { useState, useEffect } from 'react'

export type UserRole = 'Partner' | 'Associate' | 'Auditor'

export function useUserRole(): UserRole | null {
  const [role, setRole] = useState<UserRole | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/user/profile')
      .then((res) => {
        if (!res.ok) throw new Error('profile fetch failed')
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setRole((data.data?.role as UserRole) ?? null)
        }
      })
      .catch(() => {
        // Silently fail — privilege toggle stays hidden (safe default)
      })

    return () => { cancelled = true }
  }, [])

  return role
}
