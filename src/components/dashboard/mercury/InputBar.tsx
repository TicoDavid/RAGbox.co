'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useMercuryStore, type SessionAttachment } from '@/stores/mercuryStore'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import {
  Paperclip,
  Square,
  ArrowUp,
  FileUp,
  Image,
  Link,
  X,
  FileText,
  Loader2,
  ChevronDown,
  AlertTriangle,
} from 'lucide-react'
import { VoiceTrigger } from './VoiceTrigger'
import { PERSONAS } from './personaData'
import { IntelligenceMatrix, IntelligenceBadge } from './IntelligenceMatrix'

// Re-export persona data for use in GlobalHeader
export { PERSONAS, type Persona, type PersonaCategory } from './personaData'
import {
  CrownIcon,
  VaultDiamondIcon,
  NetworkSystemIcon,
  ScopeIcon,
  BroadcastIcon,
  CircuitNodeIcon,
  ScaleIcon,
  ComplianceIcon,
  AuditorIcon,
  LanternIcon,
} from '../icons/SovereignIcons'

// Persona/Lens types
type PersonaCategory = 'EXECUTIVE' | 'COMPLIANCE'

interface Persona {
  id: string
  label: string
  Icon: React.FC<{ className?: string; size?: number; color?: string }>
  description: string
  systemPrompt: string  // The actual instruction for power users
  category: PersonaCategory
  isWhistleblower?: boolean
}

// Re-export persona data for use in GlobalHeader
export { PERSONAS, type Persona, type PersonaCategory } from './personaData'

export function InputBar() {
  const inputValue = useMercuryStore((s) => s.inputValue)
  const setInputValue = useMercuryStore((s) => s.setInputValue)
  const sendMessage = useMercuryStore((s) => s.sendMessage)
  const stopStreaming = useMercuryStore((s) => s.stopStreaming)
  const isStreaming = useMercuryStore((s) => s.isStreaming)
  const attachments = useMercuryStore((s) => s.attachments)
  const addAttachment = useMercuryStore((s) => s.addAttachment)
  const removeAttachment = useMercuryStore((s) => s.removeAttachment)
  const updateAttachment = useMercuryStore((s) => s.updateAttachment)
  const activePersona = useMercuryStore((s) => s.activePersona)
  const privilegeMode = usePrivilegeStore((s) => s.isEnabled)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const [isInjectMenuOpen, setIsInjectMenuOpen] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [isMatrixOpen, setIsMatrixOpen] = useState(false)

  const currentPersona = PERSONAS.find((p) => p.id === activePersona) || PERSONAS[0]
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isInjectMenuOpen, setIsInjectMenuOpen] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [isMatrixOpen, setIsMatrixOpen] = useState(false)

  const currentPersona = PERSONAS.find((p) => p.id === activePersona) || PERSONAS[0]

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
    }
  }, [inputValue])

  // File handling for Ad-Hoc Injection
  const handleFileSelect = useCallback(
    async (files: FileList | null, isImage = false) => {
      if (!files) return
      setIsInjectMenuOpen(false)

      for (const file of Array.from(files)) {
        const attachmentId = addAttachment({
          name: file.name,
          type: isImage ? 'image' : 'file',
          mimeType: file.type,
          size: file.size,
        })

        const reader = new FileReader()
        reader.onload = () => {
          updateAttachment(attachmentId, {
            content: reader.result as string,
            status: 'ready',
          })
        }
        reader.onerror = () => {
          updateAttachment(attachmentId, { status: 'error' })
        }
        reader.readAsDataURL(file)
      }
    },
    [addAttachment, updateAttachment]
  )
  const handleFileSelect = useCallback(async (files: FileList | null, isImage = false) => {
    if (!files) return
    setIsInjectMenuOpen(false)

    for (const file of Array.from(files)) {
      const attachmentId = addAttachment({
        name: file.name,
        type: isImage ? 'image' : 'file',
        mimeType: file.type,
        size: file.size,
      })

      // Read file as base64
      const reader = new FileReader()
      reader.onload = () => {
        updateAttachment(attachmentId, {
          content: reader.result as string,
          status: 'ready',
        })

        const reader = new FileReader()
        reader.onload = () => {
          updateAttachment(attachmentId, {
            content: reader.result as string,
            status: 'ready',
          })
        }
        reader.onerror = () => {
          updateAttachment(attachmentId, { status: 'error' })
        }
        reader.readAsDataURL(file)
      }
    },
    [addAttachment, updateAttachment]
  )

  const handleUrlAdd = useCallback(() => {
    if (!urlValue.trim()) return

    const attachmentId = addAttachment({
      name: urlValue,
      type: 'url',
      url: urlValue,
    })

    updateAttachment(attachmentId, { status: 'processing' })

    fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: urlValue }),
    })
      .then((res) => res.json())
      .then((data) => {
        updateAttachment(attachmentId, {
          extractedText: data.content || data.text || 'Unable to extract content',
          status: 'ready',
        })
      })
      .catch(() => {
        updateAttachment(attachmentId, { status: 'error' })
      })

    setUrlValue('')
    setShowUrlInput(false)
    setIsInjectMenuOpen(false)
  }, [urlValue, addAttachment, updateAttachment])

  // Paste handler for images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            const attachmentId = addAttachment({
              name: `Pasted Image ${new Date().toLocaleTimeString()}`,
              type: 'image',
              mimeType: file.type,
              size: file.size,
            })

            const reader = new FileReader()
            reader.onload = () => {
              updateAttachment(attachmentId, {
                content: reader.result as string,
                status: 'ready',
              })
            }
            reader.readAsDataURL(file)
          }
          break
        }
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [addAttachment, updateAttachment])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault()
      sendMessage(privilegeMode)
    }
  }

  const handleSubmit = () => {
    sendMessage(privilegeMode)
  }

  // Voice input handlers
  const handleVoiceTranscript = useCallback(
    (text: string) => {
      setInputValue(text)
    },
    [setInputValue]
  )

  const handleVoiceSubmit = useCallback(
    (text: string) => {
      setInputValue(text)
      setTimeout(() => {
        sendMessage(privilegeMode)
      }, 50)
    },
    [setInputValue, sendMessage, privilegeMode]
  )

  const handleVoiceSubmit = useCallback(
    (text: string) => {
      setInputValue(text)
      setTimeout(() => {
        sendMessage(privilegeMode)
      }, 50)
    },
    [setInputValue, sendMessage, privilegeMode]
  )
  const canSend = (inputValue.trim().length > 0 || attachments.length > 0) && !isStreaming

  // Get icon for attachment type
  const getAttachmentIcon = (attachment: SessionAttachment) => {
    if (attachment.type === 'image') return <Image className="w-3 h-3" />
    if (attachment.type === 'url') return <Link className="w-3 h-3" />
    if (attachment.mimeType?.includes('pdf')) return <FileText className="w-3 h-3" />
    return <FileUp className="w-3 h-3" />
  }
  const canSend = inputValue.trim().length > 0 && !isStreaming

  const canSend = (inputValue.trim().length > 0 || attachments.length > 0) && !isStreaming

  // Get icon for attachment type
  const getAttachmentIcon = (attachment: SessionAttachment) => {
    if (attachment.type === 'image') return <Image className="w-3 h-3" />
    if (attachment.type === 'url') return <Link className="w-3 h-3" />
    if (attachment.mimeType?.includes('pdf')) return <FileText className="w-3 h-3" />
    return <FileUp className="w-3 h-3" />
  }

  return (
    <div className="shrink-0 px-4 py-4 bg-transparent">
      {/* Focus Column - Constrained width to match conversation */}
      <div className="max-w-3xl mx-auto">
        {/* Attachment Chips (shown above input when files attached) */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 px-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className={`
                  inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                  transition-all duration-200
                  ${
                    attachment.status === 'error'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : attachment.status === 'processing'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  }
                `}
              >
                {attachment.status === 'processing' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  getAttachmentIcon(attachment)
                )}
                <span className="max-w-[120px] truncate">{attachment.name}</span>
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Intelligence Badge - Above Input */}
        <div className="relative mb-2">
          <IntelligenceBadge onClick={() => setIsMatrixOpen(true)} />
          <IntelligenceMatrix
            isOpen={isMatrixOpen}
            onClose={() => setIsMatrixOpen(false)}
          />
        </div>

        {/* Piano Black Input Capsule - Executive Luxury */}
        <div
          className={`
            flex items-center gap-2 px-5 py-3.5
            rounded-full
            bg-[#050505] border border-white/10 border-t-white/20
            shadow-2xl shadow-black/80
            focus-within:border-amber-500/30 focus-within:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.9)]
            transition-all duration-500 ease-out
          `}
        >
          {/* Paperclip - Inject Context (Left) */}
          <div className="relative shrink-0">
            <button
              onClick={() => setIsInjectMenuOpen(!isInjectMenuOpen)}
              className={`
                p-1.5 rounded-full transition-all duration-200
                ${
                  isInjectMenuOpen
                    ? 'text-white bg-white/10'
                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                }
              `}
              title="Inject Context"
            >
              <Paperclip className="w-5 h-5" />
            </button>
    <div className="shrink-0 border-t border-[var(--border-default)] border-t-white/10 bg-[var(--bg-secondary)] px-4 py-3">
      {/* Persona Selector - Above input */}
      <div className="mb-3 flex justify-center">
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`
              flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
              ${isWhistleblowerMode
                ? 'bg-amber-900/30 border border-amber-500/50 text-amber-400 hover:bg-amber-900/50 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                : 'bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
              }
            `}
          >
            {/* Status Dot - Pulsing Red for Whistleblower */}
            <span className={`w-2 h-2 rounded-full ${
              isWhistleblowerMode
                ? 'bg-red-500 animate-ping'
                : 'bg-emerald-500'
            }`} />
            <CurrentIcon
              size={18}
              color={isWhistleblowerMode ? '#FBBF24' : '#C0C0C0'}
            />
            <span>Viewing as: {currentPersona.label}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {isDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => { setIsDropdownOpen(false); setHoveredPersona(null) }} />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-96 bg-[#0B1221]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 py-2 overflow-hidden">
                {/* System Prompt Preview (on hover) */}
                {hoveredPersona && (
                  <div className="px-4 py-3 bg-slate-900/80 border-b border-white/10">
                    <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider mb-1">
                      System Instruction
                    </p>
                    <p className="text-xs text-slate-400 italic">
                      "{PERSONAS.find(p => p.id === hoveredPersona)?.systemPrompt}"
                    </p>
                  </div>
                )}

                {/* Executive Section */}
                <div className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-white/5">
                  Executive Leadership
                </div>
                {executivePersonas.map((persona) => {
                  const Icon = persona.Icon
                  const isSelected = persona.id === activePersona
                  return (
                    <button
                      key={persona.id}
                      onClick={() => { setPersona(persona.id as any); setIsDropdownOpen(false); setHoveredPersona(null) }}
                      onMouseEnter={() => setHoveredPersona(persona.id)}
                      onMouseLeave={() => setHoveredPersona(null)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors ${
                        isSelected ? 'bg-[var(--brand-blue)]/10' : ''
                      }`}
                    >
                      <Icon
                        size={20}
                        color={isSelected ? '#60A5FA' : '#C0C0C0'}
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${isSelected ? 'text-[var(--brand-blue)]' : 'text-slate-300'}`}>
                          {persona.label}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{persona.description}</div>
                      </div>
                      {isSelected && (
                        <span className="text-[var(--brand-blue)] text-sm">✓</span>
                      )}
                    </button>
                  )
                })}

            {/* Inject Menu Popover */}
            {isInjectMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => {
                    setIsInjectMenuOpen(false)
                    setShowUrlInput(false)
                  }}
                />
                <div className="absolute bottom-full left-0 mb-2 w-52 bg-[#0a0f1a]/98 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/5">
                    <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">
                      Inject Context
                    </p>
                    <p className="text-[10px] text-slate-500">Session only</p>
                  </div>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <FileUp className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="block">Upload File</span>
                      <span className="text-[10px] text-slate-500">PDF, DOCX, TXT</span>
                    </div>
                  </button>

                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <Image className="w-4 h-4 text-purple-400" />
                    <div>
                      <span className="block">Add Image</span>
                      <span className="text-[10px] text-slate-500">Screenshots, Charts</span>
                    </div>
                  </button>

                  {showUrlInput ? (
                    <div className="px-3 py-2 border-t border-white/5">
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={urlValue}
                          onChange={(e) => setUrlValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleUrlAdd()}
                          placeholder="https://..."
                          autoFocus
                          className="flex-1 px-2 py-1.5 text-xs bg-slate-900/50 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                        <button
                          onClick={handleUrlAdd}
                          disabled={!urlValue.trim()}
                          className="px-2 py-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-medium rounded-md transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowUrlInput(true)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                {/* Compliance Section - With Whistleblower Warning */}
                <div className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Compliance & Oversight
                </div>
                {compliancePersonas.map((persona) => {
                  const Icon = persona.Icon
                  const isSelected = persona.id === activePersona
                  const iconColor = persona.isWhistleblower
                    ? (isSelected ? '#FBBF24' : '#D97706')
                    : (isSelected ? '#60A5FA' : '#C0C0C0')

                  return (
                    <button
                      key={persona.id}
                      onClick={() => { setPersona(persona.id as any); setIsDropdownOpen(false); setHoveredPersona(null) }}
                      onMouseEnter={() => setHoveredPersona(persona.id)}
                      onMouseLeave={() => setHoveredPersona(null)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors ${
                        isSelected
                          ? persona.isWhistleblower
                            ? 'bg-amber-900/20'
                            : 'bg-[var(--brand-blue)]/10'
                          : ''
                      }`}
                    >
                      <Link className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="block">Add URL</span>
                        <span className="text-[10px] text-slate-500">Quick scrape</span>
                      </div>
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <input
              ref={imageInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              multiple
              onChange={(e) => handleFileSelect(e.target.files, true)}
            />
          </div>

          {/* Textarea (Center - flex-1 takes remaining space) */}
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachments.length > 0 ? 'Ask about attached context...' : 'Ask anything...'}
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 resize-none outline-none min-h-[24px] max-h-[120px] py-0.5 pr-2"
          />

          {/* Right side action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Voice Trigger - Inside Capsule */}
            <VoiceTrigger
              onTranscript={handleVoiceTranscript}
              onSubmit={handleVoiceSubmit}
              disabled={isStreaming}
              size="default"
              variant="inline"
            />

            {/* Stop / Send Button */}
            {isStreaming ? (
              <button
                onClick={stopStreaming}
                className="p-2 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                title="Stop"
              >
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSend}
                className={`p-2 rounded-full transition-all duration-200 ${
                  canSend
                    ? 'bg-white text-black hover:bg-slate-200'
                    : 'bg-white/10 text-slate-600 cursor-not-allowed'
                }`}
                title="Send (Shift+Enter)"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>
      {/* Attachment Chips (shown above input when files attached) */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-1">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
                )}
                <span className="max-w-[120px] truncate">{attachment.name}</span>
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Intelligence Badge - Above Input */}
        <div className="relative mb-2">
          <IntelligenceBadge onClick={() => setIsMatrixOpen(true)} />
          <IntelligenceMatrix
            isOpen={isMatrixOpen}
            onClose={() => setIsMatrixOpen(false)}
          />
        </div>

        {/* Piano Black Input Capsule - Executive Luxury with Gold Trim */}
        <div
          className={`
            flex items-center gap-2 px-5 py-3.5
            rounded-full
            bg-[#050505] border border-amber-900/30 border-t-amber-800/40
            shadow-2xl shadow-black/80
            focus-within:border-amber-500/50 focus-within:shadow-[0_8px_32px_-8px_rgba(217,119,6,0.15)]
            transition-all duration-500 ease-out
          `}
        >
          {/* Paperclip - Inject Context (Left) */}
          <div className="relative shrink-0">
            <button
              onClick={() => setIsInjectMenuOpen(!isInjectMenuOpen)}
              className={`
                p-1.5 rounded-full transition-all duration-200
                ${
                  isInjectMenuOpen
                    ? 'text-amber-400 bg-amber-500/20'
                    : 'text-amber-700 hover:text-amber-400 hover:bg-amber-500/10'
                }
              `}
              title="Inject Context"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {/* Inject Menu Popover */}
            {isInjectMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => {
                    setIsInjectMenuOpen(false)
                    setShowUrlInput(false)
                  }}
                />
                <div className="absolute bottom-full left-0 mb-2 w-52 bg-[#0a0f1a]/98 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/5">
                    <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">
                      Inject Context
                    </p>
                    <p className="text-[10px] text-slate-500">Session only</p>
                  </div>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <FileUp className="w-4 h-4 text-cyan-400" />
                    <div>
                      <span className="block">Upload File</span>
                      <span className="text-[10px] text-slate-500">PDF, DOCX, TXT</span>
                    </div>
                  </button>

                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <Image className="w-4 h-4 text-purple-400" />
                    <div>
                      <span className="block">Add Image</span>
                      <span className="text-[10px] text-slate-500">Screenshots, Charts</span>
                    </div>
                  </button>

                  {showUrlInput ? (
                    <div className="px-3 py-2 border-t border-white/5">
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={urlValue}
                          onChange={(e) => setUrlValue(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleUrlAdd()}
                          placeholder="https://..."
                          autoFocus
                          className="flex-1 px-2 py-1.5 text-xs bg-slate-900/50 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                        <button
                          onClick={handleUrlAdd}
                          disabled={!urlValue.trim()}
                          className="px-2 py-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-medium rounded-md transition-colors"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowUrlInput(true)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Link className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="block">Add URL</span>
                        <span className="text-[10px] text-slate-500">Quick scrape</span>
                      </div>
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
            />
            <input
              ref={imageInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              multiple
              onChange={(e) => handleFileSelect(e.target.files, true)}
            />
          </div>

          {/* Textarea (Center - flex-1 takes remaining space) */}
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachments.length > 0 ? 'Ask about attached context...' : 'Ask anything...'}
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 resize-none outline-none min-h-[24px] max-h-[120px] py-0.5 pr-2"
          />

          {/* Right side action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Voice Trigger - Inside Capsule */}
            <VoiceTrigger
              onTranscript={handleVoiceTranscript}
              onSubmit={handleVoiceSubmit}
              disabled={isStreaming}
              size="default"
              variant="inline"
            />

            {/* Stop / Send Button - Gold Gradient when active */}
            {isStreaming ? (
              <button
                onClick={stopStreaming}
                className="p-2 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                title="Stop"
              >
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSend}
                className={`p-2 rounded-full transition-all duration-300 ${
                  canSend
                    ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black hover:from-amber-300 hover:to-amber-500 shadow-lg shadow-amber-500/20'
                    : 'bg-amber-900/20 text-amber-800 cursor-not-allowed'
                }`}
                title="Send (Shift+Enter)"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Legal Status Footer - Executive Refinement */}
        <div className="flex items-center justify-center gap-2 mt-3">
          <svg className="w-3 h-3 text-amber-500/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-[10px] uppercase tracking-[0.3em] text-amber-500/40 font-medium">
            Privileged & Confidential
          </span>
        </div>
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={attachments.length > 0 ? "Ask about attached context..." : "Ask about your documents..."}
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
    </div>
  )
}
