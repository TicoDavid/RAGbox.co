'use client'

import React, { useEffect, useCallback } from 'react'
import { ContextBar } from './ContextBar'
import { ConversationThread } from './ConversationThread'
import { InputBar } from './InputBar'
import { useMercuryStore } from '@/stores/mercuryStore'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import type { ChatMessage } from '@/types/ragbox'

export function MercuryPanel() {
  const activePersona = useMercuryStore((s) => s.activePersona)
  const isRefocusing = useMercuryStore((s) => s.isRefocusing)
  const pendingAction = useMercuryStore((s) => s.pendingAction)
  const clearPendingAction = useMercuryStore((s) => s.clearPendingAction)
  const togglePrivilege = usePrivilegeStore((s) => s.toggle)

  const isWhistleblowerMode = activePersona === 'whistleblower'

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
    }
    useMercuryStore.setState((state) => ({
      messages: [...state.messages, msg],
    }))
  }, [])

  const handleVoiceResponse = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail as { text: string }
    const msg: ChatMessage = {
      id: `voice-a-${Date.now()}`,
      role: 'assistant',
      content: detail.text,
      timestamp: new Date(),
    }
    useMercuryStore.setState((state) => ({
      messages: [...state.messages, msg],
    }))
  }, [])

  useEffect(() => {
    window.addEventListener('mercury:voice-query', handleVoiceQuery)
    window.addEventListener('mercury:voice-response', handleVoiceResponse)
    return () => {
      window.removeEventListener('mercury:voice-query', handleVoiceQuery)
      window.removeEventListener('mercury:voice-response', handleVoiceResponse)
    }
  }, [handleVoiceQuery, handleVoiceResponse])

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
