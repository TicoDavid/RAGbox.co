'use client'

import { useRef, useEffect } from 'react'
import { useMercuryStore } from '@/stores/mercuryStore'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import { FileText, Mic, ArrowUp, Square } from 'lucide-react'

export function CenterInputBar() {
  const inputValue = useMercuryStore((s) => s.inputValue)
  const setInputValue = useMercuryStore((s) => s.setInputValue)
  const sendMessage = useMercuryStore((s) => s.sendMessage)
  const isStreaming = useMercuryStore((s) => s.isStreaming)
  const stopStreaming = useMercuryStore((s) => s.stopStreaming)
  const privilegeMode = usePrivilegeStore((s) => s.isEnabled)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [inputValue])

  const handleSubmit = () => {
    if (!inputValue.trim() || isStreaming) return
    sendMessage(privilegeMode)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div>
      {/* Document context indicator */}
      <div className="text-xs text-[var(--text-tertiary)] mb-2 flex items-center gap-2">
        <FileText className="w-3 h-3" />
        <span>Analyzing: All documents</span>
      </div>

      {/* Input field */}
      <div className="flex items-end gap-2 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-default)] px-4 py-3 focus-within:border-[var(--brand-blue)]/50 transition-colors">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything..."
          className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none outline-none text-base leading-relaxed max-h-[200px]"
          rows={1}
        />

        {/* Mic button (STT placeholder) */}
        <button
          className="shrink-0 p-2 rounded-full hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
          title="Voice input"
        >
          <Mic className="w-[18px] h-[18px]" />
        </button>

        {/* Send / Stop button */}
        {isStreaming ? (
          <button
            onClick={stopStreaming}
            className="shrink-0 p-2 rounded-full bg-[var(--danger)] text-white hover:opacity-90 transition-opacity" /* THEME-EXEMPT: white on danger */
            title="Stop generating"
          >
            <Square className="w-[18px] h-[18px]" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!inputValue.trim()}
            className="shrink-0 p-2 rounded-full bg-[var(--brand-blue)] text-white disabled:opacity-30 hover:opacity-90 transition-opacity" /* THEME-EXEMPT: white on brand */
            title="Send"
          >
            <ArrowUp className="w-[18px] h-[18px]" />
          </button>
        )}
      </div>
    </div>
  )
}
