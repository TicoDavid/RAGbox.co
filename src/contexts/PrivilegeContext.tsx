'use client'

/**
 * Privilege Context - RAGbox.co
 *
 * Manages the binary privilege mode toggle for attorney-client
 * and work product protection.
 *
 * When privileged mode is ON:
 * - Only privileged documents appear in the Vault
 * - RAG queries only search privileged documents
 * - Red border pulse indicates active privilege mode
 *
 * When privileged mode is OFF:
 * - All documents are visible and searchable
 * - Normal operation mode
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react'
import { useRagSounds } from '@/hooks/useRagSounds'

// Types
interface PrivilegeState {
  isPrivileged: boolean
  lastChanged: Date | null
  isLoading: boolean
  error: string | null
}

interface PrivilegeContextValue extends PrivilegeState {
  togglePrivilege: () => Promise<void>
  setPrivilegeMode: (enabled: boolean) => Promise<void>
}

// Default context value
const defaultValue: PrivilegeContextValue = {
  isPrivileged: false,
  lastChanged: null,
  isLoading: false,
  error: null,
  togglePrivilege: async () => {},
  setPrivilegeMode: async () => {},
}

// Create context
const PrivilegeContext = createContext<PrivilegeContextValue>(defaultValue)

// Provider props
interface PrivilegeProviderProps {
  children: ReactNode
  userId?: string
  initialPrivileged?: boolean
}

/**
 * Privilege Provider Component
 *
 * Wraps the application to provide privilege state management.
 * Syncs state with backend and triggers appropriate audio/visual feedback.
 */
export function PrivilegeProvider({
  children,
  userId,
  initialPrivileged = false,
}: PrivilegeProviderProps) {
  // State
  const [state, setState] = useState<PrivilegeState>({
    isPrivileged: initialPrivileged,
    lastChanged: null,
    isLoading: false,
    error: null,
  })

  // Sounds hook
  const { playLockSound } = useRagSounds()

  // Fetch initial state from server
  useEffect(() => {
    if (!userId) return

    const fetchPrivilegeState = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }))

        const response = await fetch('/api/privilege', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })

        if (response.ok) {
          const data = await response.json()
          setState((prev) => ({
            ...prev,
            isPrivileged: data.isPrivileged,
            lastChanged: data.lastChanged ? new Date(data.lastChanged) : null,
            isLoading: false,
          }))
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: 'Failed to fetch privilege state',
          }))
        }
      } catch {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Network error',
        }))
      }
    }

    fetchPrivilegeState()
  }, [userId])

  // Set privilege mode
  const setPrivilegeMode = useCallback(
    async (enabled: boolean) => {
      // Optimistic update
      const previousState = state.isPrivileged
      setState((prev) => ({
        ...prev,
        isPrivileged: enabled,
        isLoading: true,
        error: null,
      }))

      // Play lock sound for audio feedback
      playLockSound()

      try {
        const response = await fetch('/api/privilege', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ privileged: enabled }),
        })

        if (!response.ok) {
          // Revert on failure
          setState((prev) => ({
            ...prev,
            isPrivileged: previousState,
            isLoading: false,
            error: 'Failed to update privilege mode',
          }))
          return
        }

        const data = await response.json()
        setState((prev) => ({
          ...prev,
          isPrivileged: data.isPrivileged,
          lastChanged: new Date(),
          isLoading: false,
        }))
      } catch {
        // Revert on error
        setState((prev) => ({
          ...prev,
          isPrivileged: previousState,
          isLoading: false,
          error: 'Network error',
        }))
      }
    },
    [state.isPrivileged, playLockSound]
  )

  // Toggle privilege mode
  const togglePrivilege = useCallback(async () => {
    await setPrivilegeMode(!state.isPrivileged)
  }, [state.isPrivileged, setPrivilegeMode])

  // Context value
  const value: PrivilegeContextValue = {
    ...state,
    togglePrivilege,
    setPrivilegeMode,
  }

  return <PrivilegeContext.Provider value={value}>{children}</PrivilegeContext.Provider>
}

/**
 * Hook to access privilege context
 */
export function usePrivilege(): PrivilegeContextValue {
  const context = useContext(PrivilegeContext)

  if (!context) {
    throw new Error('usePrivilege must be used within a PrivilegeProvider')
  }

  return context
}

/**
 * Hook to get privilege-aware document filter
 *
 * Returns a filter function that can be used to filter documents
 * based on current privilege mode.
 */
export function usePrivilegeFilter() {
  const { isPrivileged } = usePrivilege()

  return useCallback(
    <T extends { isPrivileged?: boolean }>(documents: T[]): T[] => {
      if (!isPrivileged) {
        // Normal mode: show all non-privileged documents
        // (privileged documents are hidden in normal mode for security)
        return documents.filter((doc) => !doc.isPrivileged)
      }

      // Privileged mode: show only privileged documents
      return documents.filter((doc) => doc.isPrivileged === true)
    },
    [isPrivileged]
  )
}

/**
 * Hook to check if a document should be visible
 */
export function useDocumentVisibility() {
  const { isPrivileged } = usePrivilege()

  return useCallback(
    (document: { isPrivileged?: boolean }): boolean => {
      if (!isPrivileged) {
        // Normal mode: hide privileged documents
        return !document.isPrivileged
      }

      // Privileged mode: only show privileged documents
      return document.isPrivileged === true
    },
    [isPrivileged]
  )
}

// Export context for direct access if needed
export { PrivilegeContext }
