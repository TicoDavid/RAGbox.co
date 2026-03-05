/**
 * useUserRole — lightweight hook to fetch the current user's role
 * from the existing /api/user/profile endpoint. Caches in state;
 * fetched once on mount.
 */

import { useState, useEffect } from 'react'

export type UserRole = 'Partner' | 'Associate' | 'Auditor'

interface UserRoleInfo {
  role: UserRole | null
  isAdmin: boolean
}

export function useUserRole(): UserRole | null {
  const info = useUserRoleInfo()
  return info.role
}

export function useUserRoleInfo(): UserRoleInfo {
  const [info, setInfo] = useState<UserRoleInfo>({ role: null, isAdmin: false })

  useEffect(() => {
    let cancelled = false

    fetch('/api/user/profile')
      .then((res) => {
        if (!res.ok) throw new Error('profile fetch failed')
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setInfo({
            role: (data.data?.role as UserRole) ?? null,
            isAdmin: data.data?.isAdmin === true,
          })
        }
      })
      .catch(() => {
        // Silently fail — privilege toggle stays hidden, admin stays false (safe default)
      })

    return () => { cancelled = true }
  }, [])

  return info
}
