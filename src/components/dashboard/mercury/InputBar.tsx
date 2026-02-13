'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
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
} from 'lucide-react'
import { VoiceTrigger } from './VoiceTrigger'
import { PERSONAS } from './personaData'
import { IntelligenceMatrix, IntelligenceBadge } from './IntelligenceMatrix'
import { useSettings } from '@/contexts/SettingsContext'

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
  const { isAegisActive } = useSettings()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  const [isInjectMenuOpen, setIsInjectMenuOpen] = useState(false)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlValue, setUrlValue] = useState('')
  const [isMatrixOpen, setIsMatrixOpen] = useState(false)

  const currentPersona = PERSONAS.find((p) => p.id === activePersona) || PERSONAS[0]

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
    }
  }, [inputValue])

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
          updateAttachment(attachmentId, { content: reader.result as string, status: 'ready' })
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
    const attachmentId = addAttachment({ name: urlValue, type: 'url', url: urlValue })
    updateAttachment(attachmentId, { status: 'processing' })
    apiFetch('/api/scrape', {
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
      .catch(() => updateAttachment(attachmentId, { status: 'error' }))
    setUrlValue('')
    setShowUrlInput(false)
    setIsInjectMenuOpen(false)
  }, [urlValue, addAttachment, updateAttachment])

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
              updateAttachment(attachmentId, { content: reader.result as string, status: 'ready' })
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(privilegeMode)
    }
  }

  const handleSubmit = () => sendMessage(privilegeMode)

  // Voice-to-text: populate input only, user sends manually
  const handleVoiceTranscript = useCallback((text: string) => setInputValue(text), [setInputValue])

  const canSend = (inputValue.trim().length > 0 || attachments.length > 0) && !isStreaming

  const getAttachmentIcon = (attachment: SessionAttachment) => {
    if (attachment.type === 'image') return <Image className="w-3 h-3" />
    if (attachment.type === 'url') return <Link className="w-3 h-3" />
    if (attachment.mimeType?.includes('pdf')) return <FileText className="w-3 h-3" />
    return <FileUp className="w-3 h-3" />
  }

  return (
    <div className="shrink-0 px-4 py-4 bg-transparent">
      <div className="max-w-3xl mx-auto">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3 px-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 ${
                  attachment.status === 'error'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : attachment.status === 'processing'
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                }`}
              >
                {attachment.status === 'processing' ? <Loader2 className="w-3 h-3 animate-spin" /> : getAttachmentIcon(attachment)}
                <span className="max-w-[120px] truncate">{attachment.name}</span>
                <button onClick={() => removeAttachment(attachment.id)} className="ml-0.5 p-0.5 rounded-full hover:bg-white/10 transition-colors" aria-label={`Remove attachment ${attachment.name}`}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative mb-2">
          <IntelligenceBadge onClick={() => setIsMatrixOpen(true)} />
          <IntelligenceMatrix isOpen={isMatrixOpen} onClose={() => setIsMatrixOpen(false)} />
        </div>

        <div className={`flex items-center gap-2 px-5 py-3.5 rounded-full bg-[#050505] transition-all duration-500 ease-out ${isAegisActive ? 'border border-amber-500/40 shadow-[0_0_40px_-10px_rgba(245,158,11,0.25),0_0_80px_-20px_rgba(245,158,11,0.10)] animate-[aegisBreathe_4s_ease-in-out_infinite]' : 'border border-amber-900/30 border-t-amber-800/40 shadow-2xl shadow-black/80 focus-within:border-amber-500/50 focus-within:shadow-[0_8px_32px_-8px_rgba(217,119,6,0.15)]'}`}>
          <div className="relative shrink-0">
            <button
              onClick={() => setIsInjectMenuOpen(!isInjectMenuOpen)}
              className={`p-1.5 rounded-full transition-all duration-200 ${isInjectMenuOpen ? 'text-amber-400 bg-amber-500/20' : 'text-amber-700 hover:text-amber-400 hover:bg-amber-500/10'}`}
              title="Inject Context"
              aria-label="Attach context"
              aria-expanded={isInjectMenuOpen}
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {isInjectMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => { setIsInjectMenuOpen(false); setShowUrlInput(false) }} aria-hidden="true" />
                <div className="absolute bottom-full left-0 mb-2 w-52 bg-[#0a0f1a]/98 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 py-1 overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/5">
                    <p className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider">Inject Context</p>
                    <p className="text-[10px] text-slate-500">Session only</p>
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors" aria-label="Upload file">
                    <FileUp className="w-4 h-4 text-cyan-400" />
                    <div><span className="block">Upload File</span><span className="text-[10px] text-slate-500">PDF, DOCX, TXT</span></div>
                  </button>
                  <button onClick={() => imageInputRef.current?.click()} className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors" aria-label="Add image">
                    <Image className="w-4 h-4 text-purple-400" />
                    <div><span className="block">Add Image</span><span className="text-[10px] text-slate-500">Screenshots, Charts</span></div>
                  </button>
                  {showUrlInput ? (
                    <div className="px-3 py-2 border-t border-white/5">
                      <div className="flex gap-2">
                        <input id="inject-url" name="inject-url" type="url" value={urlValue} onChange={(e) => setUrlValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleUrlAdd()} placeholder="https://..." autoFocus className="flex-1 px-2 py-1.5 text-xs bg-slate-900/50 border border-slate-700 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500" aria-label="URL to scrape" />
                        <button onClick={handleUrlAdd} disabled={!urlValue.trim()} className="px-2 py-1.5 text-xs bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-medium rounded-md transition-colors" aria-label="Add URL">Add</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowUrlInput(true)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors" aria-label="Add URL">
                      <Link className="w-4 h-4 text-emerald-400" />
                      <div><span className="block">Add URL</span><span className="text-[10px] text-slate-500">Quick scrape</span></div>
                    </button>
                  )}
                </div>
              </>
            )}
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.md,.csv,.xlsx,.xls" multiple onChange={(e) => handleFileSelect(e.target.files)} aria-label="Upload files" />
            <input ref={imageInputRef} type="file" className="hidden" accept="image/*" multiple onChange={(e) => handleFileSelect(e.target.files, true)} aria-label="Upload images" />
          </div>

          <textarea
            ref={textareaRef}
            id="mercury-input"
            name="mercury-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={attachments.length > 0 ? 'Ask about attached context...' : 'Ask anything...'}
            rows={1}
            aria-label="Message input"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 resize-none outline-none border-none ring-0 focus:ring-0 focus:outline-none min-h-[24px] max-h-[120px] py-1 pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
            style={{ WebkitAppearance: 'none' }}
          />

          <div className="flex items-center gap-1 shrink-0">
            <VoiceTrigger onTranscript={handleVoiceTranscript} disabled={isStreaming} size="default" variant="inline" />
            {isStreaming ? (
              <button onClick={stopStreaming} className="p-2 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors" title="Stop" aria-label="Stop streaming">
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSend}
                className={`p-2 rounded-full transition-all duration-300 ${canSend ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black hover:from-amber-300 hover:to-amber-500 shadow-lg shadow-amber-500/20' : 'bg-amber-900/20 text-amber-800 cursor-not-allowed'}`}
                title="Send (Enter)"
                aria-label="Send message"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 mt-3">
          <svg className="w-3 h-3 text-amber-500/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-[10px] uppercase tracking-[0.3em] text-amber-500/40 font-medium">Privileged & Confidential</span>
        </div>
      </div>
    </div>
  )
}
