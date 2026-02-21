'use client'

import { useRef, useEffect, useState } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import { useSettings } from '@/contexts/SettingsContext'
import {
  Plus,
  Shield,
  ShieldOff,
  ChevronDown,
  Mic,
  ArrowUp,
  Square,
  FileUp,
  Link2,
  Search,
  ShieldCheck,
  Key,
  EyeOff,
} from 'lucide-react'

export function CenterInputBar() {
  // Chat store (independent from Mercury)
  const inputValue = useChatStore((s) => s.inputValue)
  const setInputValue = useChatStore((s) => s.setInputValue)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const stopStreaming = useChatStore((s) => s.stopStreaming)
  const safetyMode = useChatStore((s) => s.safetyMode)
  const toggleSafetyMode = useChatStore((s) => s.toggleSafetyMode)
  const incognitoMode = useChatStore((s) => s.incognitoMode)
  const toggleIncognito = useChatStore((s) => s.toggleIncognito)
  const setModel = useChatStore((s) => s.setModel)
  const privilegeMode = usePrivilegeStore((s) => s.isEnabled)

  // Settings for model picker
  const {
    connections,
    activeIntelligence,
    setActiveIntelligence,
    llmPolicy,
  } = useSettings()

  // Local UI state
  const [showPlusMenu, setShowPlusMenu] = useState(false)
  const [showModelMenu, setShowModelMenu] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Model info
  const byollmConnection = connections.find(
    (c) => c.verified && c.selectedModel && c.type !== 'local' && c.type !== 'custom'
  )
  const isAegis = activeIntelligence.tier === 'native'
  const modelLabel = isAegis
    ? 'AEGIS'
    : (byollmConnection?.selectedModel?.split('/').pop() || 'AEGIS')

  const canSend = inputValue.trim().length > 0 && !isStreaming

  return (
    <div className="rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-default)] focus-within:border-[var(--brand-blue)]/50 transition-all shadow-lg shadow-black/10 overflow-visible">
      {/* Textarea area */}
      <div className="px-3 sm:px-5 pt-4 pb-2">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            safetyMode
              ? 'Ask anything...'
              : 'Ask anything... or paste a URL to analyze'
          }
          className="w-full bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] resize-none outline-none border-0 shadow-none focus:ring-0 focus:border-0 focus:shadow-none focus:outline-none text-base leading-relaxed max-h-[200px]"
          rows={2}
          aria-label="Message input"
        />
      </div>

      {/* Bottom toolbar — inside the input container */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 border-t border-[var(--border-subtle)]">
        {/* ── Plus button ── */}
        <div className="relative">
          <button
            onClick={() => setShowPlusMenu(!showPlusMenu)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              showPlusMenu
                ? 'bg-[var(--brand-blue)] text-white' /* THEME-EXEMPT: white on brand */
                : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
            }`}
            title="Attach"
            aria-label="Attach files or sources"
            aria-expanded={showPlusMenu}
          >
            <Plus className="w-4 h-4" />
          </button>

          {showPlusMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowPlusMenu(false)}
                aria-hidden="true"
              />
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
                <button
                  onClick={() => {
                    fileInputRef.current?.click()
                    setShowPlusMenu(false)
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 transition-colors"
                >
                  <FileUp className="w-4 h-4 text-[var(--brand-blue)]" />
                  Upload files or images
                </button>
                <button
                  disabled
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-[var(--text-tertiary)] cursor-not-allowed"
                >
                  <Link2 className="w-4 h-4 opacity-50" />
                  <span className="opacity-50">Connectors &amp; sources</span>
                  <span className="ml-auto text-[10px] bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded-full">
                    Soon
                  </span>
                </button>
                <button
                  disabled
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-[var(--text-tertiary)] cursor-not-allowed"
                >
                  <Search className="w-4 h-4 opacity-50" />
                  <span className="opacity-50">Deep research</span>
                  <span className="ml-auto text-[10px] bg-[var(--brand-blue)]/20 text-[var(--brand-blue)] px-1.5 py-0.5 rounded-full font-medium">
                    New
                  </span>
                </button>
              </div>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls,image/*"
            multiple
            aria-label="Upload files"
          />
        </div>

        {/* ── Safety toggle ── */}
        <button
          onClick={toggleSafetyMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            safetyMode
              ? 'bg-[var(--success)]/15 text-[var(--success)]'
              : 'bg-[var(--warning)]/15 text-[var(--warning)]'
          }`}
          title={
            safetyMode
              ? 'Safety Mode: queries limited to your vault'
              : 'Unsafe Mode: can fetch external URLs'
          }
        >
          {safetyMode ? (
            <Shield className="w-3.5 h-3.5" />
          ) : (
            <ShieldOff className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">Safety</span>
        </button>

        {/* ── Incognito toggle ── */}
        <button
          onClick={toggleIncognito}
          className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
            incognitoMode
              ? 'bg-[var(--warning)]/15 text-[var(--warning)]'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          }`}
          title={
            incognitoMode
              ? 'Incognito: conversation won\'t be saved'
              : 'Enable incognito mode'
          }
        >
          <EyeOff className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Incognito</span>
        </button>

        {/* ── Model dropdown ── */}
        <div className="relative">
          <button
            onClick={() => setShowModelMenu(!showModelMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            aria-expanded={showModelMenu}
          >
            {isAegis ? (
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--warning)]" />
            ) : (
              <Key className="w-3.5 h-3.5 text-[var(--brand-blue)]" />
            )}
            {modelLabel}
            <ChevronDown className="w-3 h-3" />
          </button>

          {showModelMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowModelMenu(false)}
                aria-hidden="true"
              />
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
                <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
                  <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                    Intelligence
                  </p>
                </div>

                {/* AEGIS option */}
                <button
                  onClick={() => {
                    setActiveIntelligence({
                      id: 'aegis-core',
                      displayName: 'Aegis',
                      provider: 'RAGbox',
                      tier: 'native',
                    })
                    setModel('aegis')
                    setShowModelMenu(false)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                    isAegis
                      ? 'text-[var(--warning)] bg-[var(--warning)]/10'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <div>
                    <span className="block font-medium">AEGIS</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">
                      Sovereign RAG pipeline
                    </span>
                  </div>
                </button>

                {/* BYOLLM option */}
                {byollmConnection?.selectedModel &&
                  llmPolicy !== 'aegis_only' && (
                    <button
                      onClick={() => {
                        const modelId = byollmConnection.selectedModel!
                        const modelName = modelId.split('/').pop() || modelId
                        setActiveIntelligence({
                          id: modelId,
                          displayName: modelName,
                          provider: byollmConnection.type,
                          tier: 'private',
                        })
                        setModel(modelId)
                        setShowModelMenu(false)
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                        !isAegis
                          ? 'text-[var(--brand-blue)] bg-[var(--brand-blue)]/10'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50'
                      }`}
                    >
                      <Key className="w-4 h-4" />
                      <div>
                        <span className="block font-medium">
                          {byollmConnection.selectedModel.split('/').pop()}
                        </span>
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          via {byollmConnection.type}
                        </span>
                      </div>
                    </button>
                  )}

                {/* Connect hint when no BYOLLM */}
                {!byollmConnection && llmPolicy !== 'aegis_only' && (
                  <div className="px-3 py-2.5 text-xs text-[var(--text-tertiary)]">
                    Connect a model in Settings &rarr; Intelligence for more
                    options
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Mic button ── */}
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
          title="Voice input"
          aria-label="Voice input"
        >
          <Mic className="w-4 h-4" />
        </button>

        {/* ── Send / Stop ── */}
        {isStreaming ? (
          <button
            onClick={stopStreaming}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--danger)] text-white hover:opacity-90 transition-opacity" /* THEME-EXEMPT: white on danger */
            title="Stop generating"
            aria-label="Stop generating"
          >
            <Square className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canSend}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              canSend
                ? 'bg-[var(--brand-blue)] text-white hover:opacity-90' /* THEME-EXEMPT: white on brand */
                : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'
            }`}
            title="Send (Enter)"
            aria-label="Send message"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
