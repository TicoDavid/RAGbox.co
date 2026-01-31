'use client'

import React, { useRef, useEffect } from 'react'
import { useMercuryStore } from '@/stores/mercuryStore'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import { Mic, Paperclip, Square, ArrowUp } from 'lucide-react'

export function InputBar() {
  const inputValue = useMercuryStore((s) => s.inputValue)
  const setInputValue = useMercuryStore((s) => s.setInputValue)
  const sendMessage = useMercuryStore((s) => s.sendMessage)
  const stopStreaming = useMercuryStore((s) => s.stopStreaming)
  const isStreaming = useMercuryStore((s) => s.isStreaming)
  const privilegeMode = usePrivilegeStore((s) => s.isEnabled)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
    }
  }, [inputValue])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      sendMessage(privilegeMode)
    }
  }

  const handleSubmit = () => {
    sendMessage(privilegeMode)
  }

  const canSend = inputValue.trim().length > 0 && !isStreaming

  return (
    <div className="shrink-0 border-t border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3">
      <div className="flex items-end gap-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 focus-within:border-[var(--brand-blue)] transition-colors">
        {/* Voice button */}
        <button
          className="shrink-0 p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          title="Voice Input"
        >
          <Mic className="w-5 h-5" />
        </button>

        {/* Attach */}
        <button
          className="shrink-0 p-1.5 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          title="Attach File"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your documents..."
          rows={1}
          className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none outline-none min-h-[24px] max-h-[160px] py-1"
        />

        {/* Stop / Send */}
        {isStreaming ? (
          <button
            onClick={stopStreaming}
            className="shrink-0 p-1.5 rounded-md bg-[var(--danger)] text-white hover:bg-[var(--danger)]/80 transition-colors"
            title="Stop"
          >
            <Square className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canSend}
            className={`shrink-0 p-1.5 rounded-md transition-colors ${
              canSend
                ? 'bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-hover)]'
                : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'
            }`}
            title="Send (Shift+Enter)"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Hint */}
      <p className="text-center text-[10px] text-[var(--text-tertiary)] mt-1.5">
        ⇧ Shift + ↵ Enter to send · ↵ Enter for new line · Your data never leaves RAGbox
      </p>
    </div>
  )
}
