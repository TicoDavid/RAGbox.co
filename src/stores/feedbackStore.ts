import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'

// ============================================================================
// STORY-236: Beta Feedback Store
// ============================================================================

export type FeedbackType = 'Bug' | 'Feature' | 'Question' | 'Observation'
export type FeedbackSeverity = 'Critical' | 'High' | 'Medium' | 'Low'
export type FeedbackModule = 'Vault' | 'Mercury' | 'Studio' | 'Airlock' | 'Audit' | 'Settings' | 'Other'
export type FeedbackStatus = 'New' | 'Reviewed' | 'Filed' | 'Closed'

export interface FeedbackTicket {
  id: string
  type: FeedbackType
  severity: FeedbackSeverity
  module: FeedbackModule
  description: string
  screenshotUrl?: string
  userId: string
  sessionId: string
  timestamp: string
  currentUrl: string
  status: FeedbackStatus
  cpoNotes: string
}

export interface FeedbackFormData {
  type: FeedbackType
  severity: FeedbackSeverity
  module: FeedbackModule
  description: string
  screenshot?: File
}

interface FeedbackState {
  tickets: FeedbackTicket[]
  isSubmitting: boolean

  submitFeedback: (data: FeedbackFormData) => Promise<void>
  updateTicketStatus: (id: string, status: FeedbackStatus) => void
  updateTicketNotes: (id: string, notes: string) => void
  loadTickets: () => Promise<void>
}

function generateId(): string {
  return `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export const useFeedbackStore = create<FeedbackState>()(
  devtools(
    persist(
      (set, get) => ({
        tickets: [],
        isSubmitting: false,

        submitFeedback: async (data) => {
          set({ isSubmitting: true })

          const ticket: FeedbackTicket = {
            id: generateId(),
            type: data.type,
            severity: data.severity,
            module: data.module,
            description: data.description,
            userId: typeof window !== 'undefined' ? (document.cookie.match(/userId=([^;]+)/)?.[1] ?? 'anonymous') : 'anonymous',
            sessionId: typeof window !== 'undefined' ? (sessionStorage.getItem('sessionId') ?? 'unknown') : 'unknown',
            timestamp: new Date().toISOString(),
            currentUrl: typeof window !== 'undefined' ? window.location.href : '',
            status: 'New',
            cpoNotes: '',
          }

          // Try sending to API (may return 501 until backend is ready)
          try {
            await apiFetch('/api/feedback', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(ticket),
            })
          } catch {
            // Expected — backend not ready yet. Store locally.
          }

          set((state) => ({
            tickets: [ticket, ...state.tickets],
            isSubmitting: false,
          }))

          toast.success('Feedback submitted — thank you!')
        },

        updateTicketStatus: (id, status) => {
          set((state) => ({
            tickets: state.tickets.map((t) =>
              t.id === id ? { ...t, status } : t
            ),
          }))
        },

        updateTicketNotes: (id, notes) => {
          set((state) => ({
            tickets: state.tickets.map((t) =>
              t.id === id ? { ...t, cpoNotes: notes } : t
            ),
          }))
        },

        loadTickets: async () => {
          try {
            const res = await apiFetch('/api/feedback')
            if (res.ok) {
              const data = await res.json()
              if (Array.isArray(data.tickets)) {
                set({ tickets: data.tickets })
              }
            }
          } catch {
            // Use local store data as fallback
          }
        },
      }),
      { name: 'ragbox-feedback' }
    )
  )
)
