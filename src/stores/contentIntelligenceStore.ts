import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { apiFetch } from '@/lib/api'
import type { ContentGap, ContentGapSummary, KBHealthCheck } from '@/types/ragbox'

interface ContentIntelligenceState {
  // Content Gaps
  gaps: ContentGap[]
  gapSummary: ContentGapSummary | null
  gapsLoading: boolean

  // KB Health
  healthChecks: KBHealthCheck[]
  healthLoading: boolean
  lastHealthRun: Date | null

  // Actions
  fetchGaps: () => Promise<void>
  fetchGapSummary: () => Promise<void>
  dismissGap: (id: string) => Promise<void>
  addressGap: (id: string) => Promise<void>
  runHealthCheck: (vaultId: string) => Promise<void>
  fetchHealthHistory: (vaultId: string) => Promise<void>
}

export const useContentIntelligenceStore = create<ContentIntelligenceState>()(
  devtools((set, get) => ({
    gaps: [],
    gapSummary: null,
    gapsLoading: false,
    healthChecks: [],
    healthLoading: false,
    lastHealthRun: null,

    fetchGaps: async () => {
      set({ gapsLoading: true })
      try {
        const res = await apiFetch('/api/content-gaps?status=open&limit=50')
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            set({
              gaps: data.data.gaps,
              gapSummary: { openGaps: data.data.openCount },
            })
          }
        }
      } catch (err) {
        console.error('Failed to fetch content gaps:', err)
      } finally {
        set({ gapsLoading: false })
      }
    },

    fetchGapSummary: async () => {
      try {
        const res = await apiFetch('/api/content-gaps/summary')
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            set({ gapSummary: data.data })
          }
        }
      } catch (err) {
        console.error('Failed to fetch gap summary:', err)
      }
    },

    dismissGap: async (id: string) => {
      try {
        const res = await apiFetch(`/api/content-gaps/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'dismissed' }),
        })
        if (res.ok) {
          set((state) => ({
            gaps: state.gaps.filter((g) => g.id !== id),
            gapSummary: state.gapSummary
              ? { openGaps: Math.max(0, state.gapSummary.openGaps - 1) }
              : null,
          }))
        }
      } catch (err) {
        console.error('Failed to dismiss gap:', err)
      }
    },

    addressGap: async (id: string) => {
      try {
        const res = await apiFetch(`/api/content-gaps/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'addressed' }),
        })
        if (res.ok) {
          set((state) => ({
            gaps: state.gaps.filter((g) => g.id !== id),
            gapSummary: state.gapSummary
              ? { openGaps: Math.max(0, state.gapSummary.openGaps - 1) }
              : null,
          }))
        }
      } catch (err) {
        console.error('Failed to address gap:', err)
      }
    },

    runHealthCheck: async (vaultId: string) => {
      set({ healthLoading: true })
      try {
        const res = await apiFetch(`/api/vaults/${vaultId}/health-check`, {
          method: 'POST',
        })
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            set({
              healthChecks: [data.data.freshness, data.data.coverage, ...get().healthChecks],
              lastHealthRun: new Date(),
            })
          }
        }
      } catch (err) {
        console.error('Failed to run health check:', err)
      } finally {
        set({ healthLoading: false })
      }
    },

    fetchHealthHistory: async (vaultId: string) => {
      try {
        const res = await apiFetch(`/api/vaults/${vaultId}/health-checks`)
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            set({ healthChecks: data.data })
          }
        }
      } catch (err) {
        console.error('Failed to fetch health history:', err)
      }
    },
  }), { name: 'content-intelligence' })
)
