'use client'

import React, { useEffect, useCallback, useRef } from 'react'
import { ContextBar } from './ContextBar'
import { ConversationThread } from './ConversationThread'
import { InputBar } from './InputBar'
import { ActionConfirmationOverlay } from './ToolConfirmationDialog'
import { useMercuryStore } from '@/stores/mercuryStore'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import type { ChatMessage } from '@/types/ragbox'

export function MercuryPanel() {
  const activePersona = useMercuryStore((s) => s.activePersona)
  const isRefocusing = useMercuryStore((s) => s.isRefocusing)
  const pendingAction = useMercuryStore((s) => s.pendingAction)
  const clearPendingAction = useMercuryStore((s) => s.clearPendingAction)
  const loadThread = useMercuryStore((s) => s.loadThread)
  const threadId = useMercuryStore((s) => s.threadId)
  const togglePrivilege = usePrivilegeStore((s) => s.toggle)

  const isWhistleblowerMode = activePersona === 'whistleblower'

  // Load unified thread on mount
  useEffect(() => {
    loadThread()
  }, [loadThread])

  // Handle pending tool actions (navigate, toggle_privilege, export_audit, open_document)
  useEffect(() => {
    if (!pendingAction) return

    switch (pendingAction.type) {
      case 'navigate': {
        const panel = pendingAction.payload.panel as string
        // Dispatch custom event for dashboard layout to pick up
        window.dispatchEvent(new CustomEvent('mercury:navigate', { detail: { panel } }))
        break
      }
      case 'toggle_privilege': {
        const enabled = pendingAction.payload.enabled as boolean
        const current = usePrivilegeStore.getState().isEnabled
        if (current !== enabled) togglePrivilege()
        break
      }
      case 'export_audit': {
        window.dispatchEvent(new CustomEvent('mercury:export-audit'))
        break
      }
      case 'open_document': {
        const documentId = pendingAction.payload.documentId as string
        window.dispatchEvent(new CustomEvent('mercury:open-document', { detail: { documentId } }))
        break
      }
    }

    clearPendingAction()
  }, [pendingAction, clearPendingAction, togglePrivilege])

  // Listen for vault upload events and inject a notification into the chat
  const handleUploadNotification = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail as { filename: string; size: number }
    const notification: ChatMessage = {
      id: `notify-${Date.now()}`,
      role: 'assistant',
      content: `**Document uploaded:** ${detail.filename} (${formatFileSize(detail.size)}) is now being indexed. You can query it once processing completes.`,
      timestamp: new Date(),
      channel: 'dashboard',
    }
    useMercuryStore.setState((state) => ({
      messages: [...state.messages, notification],
    }))
  }, [])

  useEffect(() => {
    window.addEventListener('vault:document-uploaded', handleUploadNotification)
    return () => window.removeEventListener('vault:document-uploaded', handleUploadNotification)
  }, [handleUploadNotification])

  // Sync voice transcript to Mercury chat history
  const handleVoiceQuery = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail as { text: string }
    const msg: ChatMessage = {
      id: `voice-q-${Date.now()}`,
      role: 'user',
      content: detail.text,
      timestamp: new Date(),
      channel: 'voice',
    }
    useMercuryStore.setState((state) => ({
      messages: [...state.messages, msg],
    }))
    // Persist voice message to thread
    fetch('/api/mercury/thread/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threadId,
        role: 'user',
        channel: 'voice',
        content: detail.text,
      }),
    }).catch(() => {})
  }, [threadId])

  const handleVoiceResponse = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail as { text: string }
    const msg: ChatMessage = {
      id: `voice-a-${Date.now()}`,
      role: 'assistant',
      content: detail.text,
      timestamp: new Date(),
      channel: 'voice',
    }
    useMercuryStore.setState((state) => ({
      messages: [...state.messages, msg],
    }))
    // Persist voice response to thread
    fetch('/api/mercury/thread/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threadId,
        role: 'assistant',
        channel: 'voice',
        content: detail.text,
      }),
    }).catch(() => {})
  }, [threadId])

  useEffect(() => {
    window.addEventListener('mercury:voice-query', handleVoiceQuery)
    window.addEventListener('mercury:voice-response', handleVoiceResponse)
    return () => {
      window.removeEventListener('mercury:voice-query', handleVoiceQuery)
      window.removeEventListener('mercury:voice-response', handleVoiceResponse)
    }
  }, [handleVoiceQuery, handleVoiceResponse])

  // Poll for new messages from other channels (WhatsApp, voice from other devices)
  // Uses a ref-based guard to prevent concurrent polls and a stable cursor
  // to avoid re-fetching messages we already have.
  const pollingRef = useRef(false)
  const lastPollCursorRef = useRef<string | null>(null)

  useEffect(() => {
    if (!threadId) return

    // Reset cursor when threadId changes
    lastPollCursorRef.current = null

    const poll = async () => {
      // Guard: skip if a previous poll is still in-flight
      if (pollingRef.current) return
      pollingRef.current = true

      try {
        const currentMessages = useMercuryStore.getState().messages

        // Use the latest server-originated message's createdAt as cursor,
        // or fall back to the last message timestamp, or 24h ago.
        let after = lastPollCursorRef.current
        if (!after) {
          after = currentMessages.length > 0
            ? currentMessages[currentMessages.length - 1].timestamp.toISOString()
            : new Date(Date.now() - 86400000).toISOString()
        }

        const res = await fetch(
          `/api/mercury/thread/messages?threadId=${threadId}&after=${encodeURIComponent(after)}&limit=20`
        )
        if (!res.ok) return

        const data = await res.json()
        const newMessages: Array<{
          id: string; role: string; channel: string; content: string;
          confidence?: number; citations?: unknown; metadata?: Record<string, unknown>;
          createdAt: string
        }> = data.data?.messages || []

        if (newMessages.length === 0) return

        // Advance the cursor to the latest server message's createdAt
        // so the next poll only fetches newer messages
        const latestCreatedAt = newMessages[newMessages.length - 1].createdAt
        lastPollCursorRef.current = latestCreatedAt

        // Deduplicate by both ID and content+timestamp to catch locally-
        // created messages that were persisted with a different server ID
        const existing = useMercuryStore.getState().messages
        const existingIds = new Set(existing.map((m: ChatMessage) => m.id))
        const existingContentKeys = new Set(
          existing.map((m: ChatMessage) => `${m.role}:${m.content.slice(0, 80)}`)
        )

        const toAdd = newMessages
          .filter((m) => {
            if (existingIds.has(m.id)) return false
            // Skip if we already have a message with the same role+content prefix
            // (catches fire-and-forget persisted messages with different IDs)
            const contentKey = `${m.role}:${m.content.slice(0, 80)}`
            if (existingContentKeys.has(contentKey)) return false
            return true
          })
          .map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: new Date(m.createdAt),
            confidence: m.confidence ?? undefined,
            citations: m.citations as ChatMessage['citations'],
            channel: m.channel as ChatMessage['channel'],
            metadata: m.metadata ?? undefined,
          }))

        if (toAdd.length > 0) {
          useMercuryStore.setState((state) => ({
            messages: [...state.messages, ...toAdd],
          }))
        }
      } catch {
        // Silent fail — polling is best-effort
      } finally {
        pollingRef.current = false
      }
    }

    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [threadId])

  // Apply theme shift for Whistleblower mode
  useEffect(() => {
    const root = document.documentElement

    if (isWhistleblowerMode) {
      // Nuclear Mode: Shift to Amber/Orange
      root.style.setProperty('--brand-blue', '#F59E0B')
      root.style.setProperty('--brand-blue-hover', '#D97706')
    } else {
      // Normal Mode: Royal Cobalt
      root.style.setProperty('--brand-blue', '#2463EB')
      root.style.setProperty('--brand-blue-hover', '#1D4ED8')
    }

    return () => {
      // Cleanup: Reset to default on unmount
      root.style.setProperty('--brand-blue', '#2463EB')
      root.style.setProperty('--brand-blue-hover', '#1D4ED8')
    }
  }, [isWhistleblowerMode])

  return (
    <div
      className={`
        relative flex flex-col h-full bg-[var(--bg-primary)] overflow-hidden transition-all duration-300
        ${isWhistleblowerMode ? 'ring-2 ring-amber-500/30 ring-inset' : ''}
      `}
    >
      {/* Layer 2: The Watermark — sits ABOVE bg, BELOW content */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
        aria-hidden="true"
      >
        <img
          src="https://storage.googleapis.com/connexusai-assets/RAGb%C3%B6x_ICON.png"
          alt=""
          className="w-[600px] h-auto opacity-20 select-none"
          draggable={false}
          style={{ filter: 'sepia(1) hue-rotate(-15deg) saturate(1.5)' }}
        />
      </div>

      {/* Layer 3: All content — transparent bg so watermark shows through */}
      <div className="relative z-10 flex flex-col h-full">
        <ContextBar />

        {/* Conversation with Lens Refocus Animation */}
        <div
          className={`
            flex-1 min-h-0
            ${isRefocusing ? 'animate-refocus' : ''}
          `}
        >
          <ConversationThread />
        </div>

        <InputBar />
      </div>

      {/* Email / SMS Confirmation Overlay */}
      <ActionConfirmationOverlay />

      {/* Refocus Animation Keyframes */}
      <style jsx global>{`
        @keyframes refocus {
          0% { filter: blur(0px); opacity: 1; }
          50% { filter: blur(4px); opacity: 0.8; }
          100% { filter: blur(0px); opacity: 1; }
        }
        .animate-refocus {
          animation: refocus 0.6s ease-in-out;
        }
      `}</style>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
