/**
 * WhatsApp Store - RAGbox.co
 *
 * Zustand store for WhatsApp conversations, messages, and real-time updates.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { apiFetch } from '@/lib/api'

// ============================================================================
// TYPES
// ============================================================================

export interface WhatsAppContact {
  id: string
  phoneNumber: string
  displayName: string | null
}

export interface WhatsAppConversation {
  id: string
  userId: string
  contactId: string
  status: 'active' | 'archived' | 'blocked'
  autoReply: boolean
  unreadCount: number
  lastMessageText: string | null
  lastMessageAt: string | null
  createdAt: string
  contact: WhatsAppContact
}

export interface WhatsAppMessage {
  id: string
  conversationId: string
  externalMessageId: string | null
  direction: 'inbound' | 'outbound'
  messageType: 'text' | 'audio' | 'image' | 'document' | 'system'
  content: string | null
  mediaUrl: string | null
  status: 'sent' | 'delivered' | 'read' | 'failed'
  confidence: number | null
  queryId: string | null
  createdAt: string
  /** Client-side flag for auto-replied messages */
  autoReply?: boolean
  contactName?: string
}

// ============================================================================
// STORE
// ============================================================================

interface WhatsAppState {
  conversations: WhatsAppConversation[]
  activeConversationId: string | null
  messages: Record<string, WhatsAppMessage[]>
  isLoading: boolean
  isSending: boolean
  totalUnread: number

  // Actions
  fetchConversations: () => Promise<void>
  fetchMessages: (conversationId: string) => Promise<void>
  setActiveConversation: (id: string | null) => void
  sendMessage: (conversationId: string, text: string) => Promise<void>
  markAsRead: (conversationId: string) => Promise<void>
  toggleAutoReply: (conversationId: string) => void
  handleIncomingMessage: (conversationId: string, msg: WhatsAppMessage) => void
  handleStatusUpdate: (conversationId: string, messageId: string, status: string) => void
}

export const useWhatsAppStore = create<WhatsAppState>()(
  devtools((set, get) => ({
    conversations: [],
    activeConversationId: null,
    messages: {},
    isLoading: false,
    isSending: false,
    totalUnread: 0,

    fetchConversations: async () => {
      set({ isLoading: true })
      try {
        const res = await apiFetch('/api/whatsapp/conversations')
        if (res.ok) {
          const json = await res.json()
          const conversations = json.data || []
          const totalUnread = conversations.reduce(
            (sum: number, c: WhatsAppConversation) => sum + c.unreadCount,
            0
          )
          set({ conversations, totalUnread })
        }
      } catch (error) {
        console.error('[WhatsApp Store] Fetch conversations failed:', error)
      } finally {
        set({ isLoading: false })
      }
    },

    fetchMessages: async (conversationId) => {
      try {
        const res = await apiFetch(`/api/whatsapp/conversations/${conversationId}/messages`)
        if (res.ok) {
          const json = await res.json()
          const raw = json.data ?? json
          const msgs = Array.isArray(raw) ? raw : raw.messages || raw.data || []
          set((state) => ({
            messages: {
              ...state.messages,
              [conversationId]: msgs,
            },
          }))
        }
      } catch (error) {
        console.error('[WhatsApp Store] Fetch messages failed:', error)
      }
    },

    setActiveConversation: (id) => {
      set({ activeConversationId: id })
      if (id) {
        get().fetchMessages(id)
        get().markAsRead(id)
      }
    },

    sendMessage: async (conversationId, text) => {
      if (!text.trim() || get().isSending) return

      set({ isSending: true })
      try {
        const res = await apiFetch(`/api/whatsapp/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })

        if (res.ok) {
          // Optimistic: add message locally
          const optimisticMsg: WhatsAppMessage = {
            id: `temp-${Date.now()}`,
            conversationId,
            externalMessageId: null,
            direction: 'outbound',
            messageType: 'text',
            content: text,
            mediaUrl: null,
            status: 'sent',
            confidence: null,
            queryId: null,
            createdAt: new Date().toISOString(),
          }

          set((state) => {
            const existing = state.messages[conversationId] || []
            return {
              messages: {
                ...state.messages,
                [conversationId]: [...existing, optimisticMsg],
              },
              conversations: state.conversations.map((c) =>
                c.id === conversationId
                  ? { ...c, lastMessageText: text.slice(0, 100), lastMessageAt: new Date().toISOString() }
                  : c
              ),
            }
          })
        }
      } catch (error) {
        console.error('[WhatsApp Store] Send message failed:', error)
      } finally {
        set({ isSending: false })
      }
    },

    markAsRead: async (conversationId) => {
      try {
        await apiFetch(`/api/whatsapp/conversations/${conversationId}/read`, {
          method: 'POST',
        })

        set((state) => {
          const conv = state.conversations.find((c) => c.id === conversationId)
          const readCount = conv?.unreadCount || 0
          return {
            conversations: state.conversations.map((c) =>
              c.id === conversationId ? { ...c, unreadCount: 0 } : c
            ),
            totalUnread: Math.max(0, state.totalUnread - readCount),
          }
        })
      } catch (error) {
        console.error('[WhatsApp Store] Mark as read failed:', error)
      }
    },

    toggleAutoReply: (conversationId) => {
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, autoReply: !c.autoReply } : c
        ),
      }))
    },

    handleIncomingMessage: (conversationId, msg) => {
      set((state) => {
        const existing = state.messages[conversationId] || []
        // Avoid duplicates
        if (existing.some((m) => m.id === msg.id)) return state

        const isActive = state.activeConversationId === conversationId
        const unreadIncrement = msg.direction === 'inbound' && !isActive ? 1 : 0

        return {
          messages: {
            ...state.messages,
            [conversationId]: [...existing, msg],
          },
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  lastMessageText: (msg.content || `[${msg.messageType}]`).slice(0, 100),
                  lastMessageAt: msg.createdAt,
                  unreadCount: c.unreadCount + unreadIncrement,
                }
              : c
          ),
          totalUnread: state.totalUnread + unreadIncrement,
        }
      })
    },

    handleStatusUpdate: (conversationId, messageId, status) => {
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: (state.messages[conversationId] || []).map((m) =>
            m.id === messageId ? { ...m, status: status as WhatsAppMessage['status'] } : m
          ),
        },
      }))
    },
  }), { name: 'whatsapp-store' })
)
