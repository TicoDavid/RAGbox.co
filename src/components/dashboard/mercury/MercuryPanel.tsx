'use client'

import React, { useEffect, useCallback } from 'react'
import { ContextBar } from './ContextBar'
import { ConversationThread } from './ConversationThread'
import { InputBar } from './InputBar'
import { ActionConfirmationOverlay } from './ToolConfirmationDialog'
import { useMercuryStore } from '@/stores/mercuryStore'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import type { ChatMessage } from '@/types/ragbox'

// ============================================================================
// Module-level polling singleton — guarantees exactly ONE interval regardless
// of how many times React mounts/unmounts MercuryPanel (Strict Mode, HMR, etc.)
// ============================================================================
let _pollInterval: ReturnType<typeof setInterval> | null = null
let _pollThreadId: string | null = null
let _pollInFlight = false
let _pollCursor: string | null = null

function startThreadPolling(threadId: string) {
  // Already polling this thread — do nothing
  if (_pollInterval && _pollThreadId === threadId) return

  // Different thread or first start — tear down any existing interval
  stopThreadPolling()
  _pollThreadId = threadId
  _pollCursor = null

  const poll = async () => {
    if (_pollInFlight) return
    _pollInFlight = true

    try {
      const currentMessages = useMercuryStore.getState().messages

      let after = _pollCursor
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

      // Advance cursor so the next poll only fetches newer messages
      _pollCursor = newMessages[newMessages.length - 1].createdAt

      // Deduplicate by ID and content prefix (catches fire-and-forget persisted
      // messages that come back from the server with a different cuid)
      const existing = useMercuryStore.getState().messages
      const existingIds = new Set(existing.map((m: ChatMessage) => m.id))
      const existingContentKeys = new Set(
        existing.map((m: ChatMessage) => `${m.role}:${m.content.slice(0, 80)}`)
      )

      const toAdd = newMessages
        .filter((m) => {
          if (existingIds.has(m.id)) return false
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
      _pollInFlight = false
    }
  }

  _pollInterval = setInterval(poll, 5000)
}

function stopThreadPolling() {
  if (_pollInterval) {
    clearInterval(_pollInterval)
    _pollInterval = null
  }
  _pollThreadId = null
  _pollInFlight = false
  _pollCursor = null
}

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

  // Listen for batch upload event — one notification per upload batch.
  useEffect(() => {
    const handler = (e: Event) => {
      const { files } = (e as CustomEvent).detail as { files: Array<{ filename: string; size: number }> }
      if (!files || files.length === 0) return

      const content = files.length === 1
        ? `**Document uploaded:** ${files[0].filename} (${formatFileSize(files[0].size)}) is now being indexed.`
        : `**${files.length} documents uploaded** and being indexed:\n${files.map((d) => `- ${d.filename} (${formatFileSize(d.size)})`).join('\n')}`

      const notification: ChatMessage = {
        id: `notify-${Date.now()}`,
        role: 'assistant',
        content,
        timestamp: new Date(),
        channel: 'dashboard',
      }
      useMercuryStore.setState((state) => ({
        messages: [...state.messages, notification],
      }))
    }

    window.addEventListener('vault:documents-uploaded', handler)
    return () => window.removeEventListener('vault:documents-uploaded', handler)
  }, [])

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

  // Start / stop the module-level polling singleton when threadId changes.
  // Because the poll state lives outside React, Strict Mode double-mounts,
  // HMR re-mounts, and multiple component instances all converge on a single
  // interval — exactly one fetch every 5 seconds, guaranteed.
  useEffect(() => {
    if (threadId) {
      startThreadPolling(threadId)
    }
    return () => stopThreadPolling()
  }, [threadId])

  // Apply theme shift for Whistleblower mode
  // These hex values are design-token overrides (setProperty requires raw values)
  useEffect(() => {
    const root = document.documentElement
    const COBALT_BRAND = '#2463EB'
    const COBALT_HOVER = '#1D4ED8'
    const WHISTLE_BRAND = '#F59E0B' // Amber — matches --warning
    const WHISTLE_HOVER = '#D97706' // Amber dim — matches --warning-dim

    if (isWhistleblowerMode) {
      root.style.setProperty('--brand-blue', WHISTLE_BRAND)
      root.style.setProperty('--brand-blue-hover', WHISTLE_HOVER)
    } else {
      root.style.setProperty('--brand-blue', COBALT_BRAND)
      root.style.setProperty('--brand-blue-hover', COBALT_HOVER)
    }

    return () => {
      root.style.setProperty('--brand-blue', COBALT_BRAND)
      root.style.setProperty('--brand-blue-hover', COBALT_HOVER)
    }
  }, [isWhistleblowerMode])

  return (
    <div
      className={`
        relative flex flex-col h-full bg-[var(--bg-primary)] overflow-hidden transition-all duration-300
        ${isWhistleblowerMode ? 'ring-2 ring-amber-500/30 ring-inset' : ''}
      `}
    >
      {/* All content */}
      <div className="relative flex flex-col h-full min-h-0">
        <ContextBar />

        {/* Conversation with Lens Refocus Animation */}
        <div
          className={`
            flex-1 min-h-0 flex flex-col
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
