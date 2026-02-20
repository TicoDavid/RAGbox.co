'use client'

import { useChatStore } from '@/stores/chatStore'
import { MessageSquare, FileText, X, PenLine } from 'lucide-react'

export function CenterHeader() {
  const messages = useChatStore((s) => s.messages)
  const threadTitle = useChatStore((s) => s.threadTitle)
  const documentScope = useChatStore((s) => s.documentScope)
  const documentScopeName = useChatStore((s) => s.documentScopeName)
  const setDocumentScope = useChatStore((s) => s.setDocumentScope)
  const clearThread = useChatStore((s) => s.clearThread)
  const queryCount = messages.filter((m) => m.role === 'user').length

  return (
    <div className="shrink-0 flex flex-col border-b border-[var(--border-default)]">
      <div className="flex items-center justify-between px-8 py-3">
        <div className="flex items-center gap-2 text-sm">
          <MessageSquare className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          <span className="text-[var(--text-primary)] font-medium truncate max-w-[300px]">
            {threadTitle || 'New Chat'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-[var(--text-tertiary)]">
          {queryCount > 0 && <span>{queryCount} {queryCount === 1 ? 'query' : 'queries'}</span>}
          <button
            onClick={clearThread}
            className="p-1.5 rounded-md hover:bg-[var(--bg-elevated)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="New chat"
            title="New Chat"
          >
            <PenLine className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {documentScope && documentScopeName && (
        <div className="flex items-center gap-2 px-8 pb-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--brand-blue)]/10 border border-[var(--brand-blue)]/20 text-xs">
            <FileText className="w-3 h-3 text-[var(--brand-blue)]" />
            <span className="text-[var(--brand-blue)] font-medium truncate max-w-[240px]">
              Chatting about: {documentScopeName}
            </span>
            <button
              onClick={() => setDocumentScope(null)}
              className="ml-1 p-0.5 rounded hover:bg-[var(--brand-blue)]/20 transition-colors"
              aria-label="Clear document scope"
            >
              <X className="w-3 h-3 text-[var(--brand-blue)]" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
