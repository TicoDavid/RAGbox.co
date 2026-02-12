import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'

interface PrivilegeState {
  isEnabled: boolean
  lastChanged: Date | null

  toggle: () => Promise<void>
  fetch: () => Promise<void>
}

export const usePrivilegeStore = create<PrivilegeState>()(
  devtools(
    persist(
      (set, get) => ({
        isEnabled: false,
        lastChanged: null,

        toggle: async () => {
          const newState = !get().isEnabled

          try {
            const res = await apiFetch('/api/privilege', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ privileged: newState }),
            })

            if (!res.ok) throw new Error('Privilege toggle failed')

            set({ isEnabled: newState, lastChanged: new Date() })
            toast.success(newState ? 'Privilege mode enabled' : 'Privilege mode disabled')
          } catch (error) {
            toast.error('Failed to toggle privilege mode')
            throw error
          }
        },

        fetch: async () => {
          try {
            const res = await apiFetch('/api/privilege')
            if (!res.ok) throw new Error('Failed to fetch privilege state')
            const data = await res.json()
            set({ isEnabled: data.data?.privilegeMode ?? data.isPrivileged ?? false })
          } catch {
            // Silently ignore
          }
        },
      }),
      {
        name: 'ragbox-privilege',
      }
    )
  )
)
