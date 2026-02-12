'use client'

/**
 * @deprecated This module is kept for backward compatibility only.
 * All privilege state is now managed by the Zustand store in
 * `src/stores/privilegeStore.ts`. Use `usePrivilegeStore` directly.
 *
 * - `usePrivilege()` re-exports store state in the old shape.
 * - `usePrivilegeFilter()` and `useDocumentVisibility()` are
 *   thin wrappers that read from the store.
 * - `PrivilegeProvider` is a no-op passthrough (renders children only).
 */

import { useCallback, type ReactNode } from 'react'
import { usePrivilegeStore } from '@/stores/privilegeStore'

// ---------------------------------------------------------------------------
// Backward-compatible types
// ---------------------------------------------------------------------------

interface PrivilegeContextValue {
  isPrivileged: boolean
  lastChanged: Date | null
  isLoading: boolean
  error: string | null
  togglePrivilege: () => Promise<void>
  setPrivilegeMode: (enabled: boolean) => Promise<void>
}

// ---------------------------------------------------------------------------
// PrivilegeProvider — no-op wrapper (safe to remove from layouts)
// ---------------------------------------------------------------------------

/** @deprecated No longer needed. Remove from layout trees. */
export function PrivilegeProvider({ children }: { children: ReactNode; userId?: string; initialPrivileged?: boolean }) {
  return <>{children}</>
}

// ---------------------------------------------------------------------------
// Hooks — thin adapters over the Zustand store
// ---------------------------------------------------------------------------

/** @deprecated Use `usePrivilegeStore` from `@/stores/privilegeStore` instead. */
export function usePrivilege(): PrivilegeContextValue {
  const isEnabled = usePrivilegeStore((s) => s.isEnabled)
  const lastChanged = usePrivilegeStore((s) => s.lastChanged)
  const toggle = usePrivilegeStore((s) => s.toggle)

  return {
    isPrivileged: isEnabled,
    lastChanged,
    isLoading: false,
    error: null,
    togglePrivilege: toggle,
    setPrivilegeMode: async (enabled: boolean) => {
      if (enabled !== isEnabled) {
        await toggle()
      }
    },
  }
}

/** @deprecated Use `usePrivilegeStore` and filter inline instead. */
export function usePrivilegeFilter() {
  const isEnabled = usePrivilegeStore((s) => s.isEnabled)

  return useCallback(
    <T extends { isPrivileged?: boolean }>(documents: T[]): T[] => {
      if (!isEnabled) {
        return documents.filter((doc) => !doc.isPrivileged)
      }
      return documents.filter((doc) => doc.isPrivileged === true)
    },
    [isEnabled]
  )
}

/** @deprecated Use `usePrivilegeStore` and check visibility inline instead. */
export function useDocumentVisibility() {
  const isEnabled = usePrivilegeStore((s) => s.isEnabled)

  return useCallback(
    (document: { isPrivileged?: boolean }): boolean => {
      if (!isEnabled) {
        return !document.isPrivileged
      }
      return document.isPrivileged === true
    },
    [isEnabled]
  )
}
