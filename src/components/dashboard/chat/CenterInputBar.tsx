'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useChatStore } from '@/stores/chatStore'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import { useSettings } from '@/contexts/SettingsContext'
import { useDeepgramSTT } from '@/hooks/useDeepgramSTT'
import { LlmPicker } from '@/components/dashboard/mercury/ChatModelPicker'
import { toast } from 'sonner'
import {
  Paperclip,
  Shield,
  ShieldOff,
  Mic,
  MicOff,
  ArrowUp,
  Square,
  FileUp,
  FileText,
  Link2,
  Search,
  EyeOff,
  X,
  Image,
  Loader2,
} from 'lucide-react'

interface ChatAttachment {
  id: string
  name: string
  type: 'file' | 'image'
  mimeType: string
  size: number
  content?: string
  status: 'pending' | 'ready' | 'error'
}

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

  // Settings — sync activeIntelligence to chatStore
  const { activeIntelligence } = useSettings()

  // Local UI state
  const [showPlusMenu, setShowPlusMenu] = useState(false)
  const [attachments, setAttachments] = useState<ChatAttachment[]>([])

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Voice input (STT) ──
  const { isListening, transcript, error: micError, startListening, stopListening } = useDeepgramSTT()
  const prevListeningRef = useRef(false)

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return
    setShowPlusMenu(false)
    for (const file of Array.from(files)) {
      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const isImage = file.type.startsWith('image/')
      const isTextFile = file.type.startsWith('text/') ||
        /\.(txt|md|csv|json|xml|html|css|js|ts|tsx|py|yaml|yml|log|sql)$/i.test(file.name)
      setAttachments((prev) => [...prev, {
        id,
        name: file.name,
        type: isImage ? 'image' : 'file',
        mimeType: file.type,
        size: file.size,
        status: 'pending',
      }])
      const reader = new FileReader()
      reader.onload = () => {
        setAttachments((prev) =>
          prev.map((a) => a.id === id ? { ...a, content: reader.result as string, status: 'ready' } : a)
        )
      }
      reader.onerror = () => {
        setAttachments((prev) => prev.filter((a) => a.id !== id))
        toast.error(`Failed to read ${file.name}`)
      }
      // Text files → readable text; binary → data URL (not injected into query)
      if (isTextFile) {
        reader.readAsText(file)
      } else {
        reader.readAsDataURL(file)
      }
    }
  }, [])

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [inputValue])

  // Sync activeIntelligence → chatStore.setModel
  useEffect(() => {
    if (activeIntelligence.tier === 'native') {
      setModel('aegis')
    } else {
      setModel(activeIntelligence.id)
    }
  }, [activeIntelligence, setModel])

  const handleSubmit = useCallback(() => {
    if ((!inputValue.trim() && attachments.length === 0) || isStreaming) return

    // Block send while files are still loading
    if (attachments.some((a) => a.status === 'pending')) {
      toast('Files still loading...', { duration: 2000 })
      return
    }

    // Remove failed attachments and bail so user can retry
    if (attachments.some((a) => a.status === 'error')) {
      setAttachments((prev) => prev.filter((a) => a.status !== 'error'))
      toast.error('Failed files removed — please re-attach and try again')
      return
    }

    // Build query with attachment context (text only — never inject base64)
    const readyAttachments = attachments.filter((a) => a.status === 'ready')
    if (readyAttachments.length > 0) {
      const context = readyAttachments
        .map((a) => {
          // Only include readable text content, not data URLs
          if (a.content && !a.content.startsWith('data:')) {
            return `[Attached file: ${a.name}]\n${a.content}`
          }
          return `[Attached file: ${a.name}]`
        })
        .join('\n\n')
      const fullMessage = context + (inputValue.trim() ? '\n\n' + inputValue : '')
      setInputValue(fullMessage)
    }

    sendMessage(privilegeMode)
    setAttachments([])
  }, [inputValue, attachments, isStreaming, sendMessage, privilegeMode, setInputValue])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // ── Mic toggle ──
  const handleMicToggle = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // Sync live transcript into input while listening
  useEffect(() => {
    if (isListening && transcript) {
      setInputValue(transcript)
    }
  }, [isListening, transcript, setInputValue])

  // Auto-submit when listening stops with a non-empty transcript
  useEffect(() => {
    if (prevListeningRef.current && !isListening && transcript.trim()) {
      setInputValue(transcript.trim())
      setTimeout(() => {
        handleSubmit()
      }, 50)
    }
    prevListeningRef.current = isListening
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening, transcript])

  // Show mic errors as toast
  useEffect(() => {
    if (micError) {
      toast.error(micError)
    }
  }, [micError])

  const canSend = (inputValue.trim().length > 0 || attachments.length > 0) && !isStreaming

  return (
    <div className="rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-default)] focus-within:border-[var(--brand-blue)]/50 transition-all shadow-lg shadow-black/10 overflow-visible">
      {/* LLM Picker */}
      <div className="px-3 sm:px-5 pt-3 pb-0">
        <LlmPicker />
      </div>

      {/* Attachment pills */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 sm:px-5 pt-3 pb-0">
          {attachments.map((att) => (
            <div
              key={att.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                att.status === 'error'
                  ? 'bg-[var(--danger)]/20 text-[var(--danger)] border border-[var(--danger)]/30'
                  : att.status === 'pending'
                    ? 'bg-[var(--warning)]/20 text-[var(--warning)] border border-[var(--warning)]/30'
                    : 'bg-[var(--brand-blue)]/20 text-[var(--brand-blue)] border border-[var(--brand-blue)]/30'
              }`}
            >
              {att.status === 'pending' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : att.type === 'image' ? (
                <Image className="w-3 h-3" />
              ) : att.mimeType?.includes('pdf') ? (
                <FileText className="w-3 h-3" />
              ) : (
                <FileUp className="w-3 h-3" />
              )}
              <span className="max-w-[120px] truncate">{att.name}</span>
              <button
                onClick={() => removeAttachment(att.id)}
                className="ml-0.5 p-0.5 rounded-full hover:bg-[var(--bg-elevated)] transition-colors"
                aria-label={`Remove ${att.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Textarea area */}
      <div className="px-3 sm:px-5 pt-3 pb-2">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            attachments.length > 0
              ? 'Ask about attached files...'
              : safetyMode
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
        {/* ── Attach button ── */}
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
            <Paperclip className="w-4 h-4" />
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
            onChange={(e) => { handleFileSelect(e.target.files); e.target.value = '' }}
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

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Mic button ── */}
        <button
          onClick={handleMicToggle}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            isListening
              ? 'bg-[var(--danger)]/20 text-[var(--danger)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
          }`}
          title={isListening ? 'Stop listening' : 'Voice input'}
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
        >
          {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
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
