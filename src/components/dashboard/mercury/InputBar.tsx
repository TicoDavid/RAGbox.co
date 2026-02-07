'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { useMercuryStore } from '@/stores/mercuryStore'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import { Paperclip, Square, ArrowUp, ChevronDown, AlertTriangle } from 'lucide-react'
import { VoiceTrigger } from './VoiceTrigger'
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
  category: PersonaCategory
  isWhistleblower?: boolean
}

const PERSONAS: Persona[] = [
  // Executive
  { id: 'ceo', label: 'CEO', Icon: CrownIcon, description: 'Strategic overview, high-level insights', category: 'EXECUTIVE' },
  { id: 'cfo', label: 'CFO', Icon: VaultDiamondIcon, description: 'Financial analysis, budget implications', category: 'EXECUTIVE' },
  { id: 'coo', label: 'COO', Icon: NetworkSystemIcon, description: 'Operations, process efficiency', category: 'EXECUTIVE' },
  { id: 'cpo', label: 'CPO', Icon: ScopeIcon, description: 'Product insights, roadmap alignment', category: 'EXECUTIVE' },
  { id: 'cmo', label: 'CMO', Icon: BroadcastIcon, description: 'Market reach, brand strategy', category: 'EXECUTIVE' },
  { id: 'cto', label: 'CTO', Icon: CircuitNodeIcon, description: 'Technical architecture, security', category: 'EXECUTIVE' },
  // Compliance
  { id: 'legal', label: 'Legal Counsel', Icon: ScaleIcon, description: 'Contract review, liability analysis', category: 'COMPLIANCE' },
  { id: 'compliance', label: 'Compliance Officer', Icon: ComplianceIcon, description: 'Regulatory adherence, policy check', category: 'COMPLIANCE' },
  { id: 'auditor', label: 'Internal Auditor', Icon: AuditorIcon, description: 'Control testing, risk assessment', category: 'COMPLIANCE' },
  { id: 'whistleblower', label: 'Whistleblower', Icon: LanternIcon, description: 'Forensic analysis, anomaly detection', category: 'COMPLIANCE', isWhistleblower: true },
]

export function InputBar() {
  const inputValue = useMercuryStore((s) => s.inputValue)
  const setInputValue = useMercuryStore((s) => s.setInputValue)
  const sendMessage = useMercuryStore((s) => s.sendMessage)
  const stopStreaming = useMercuryStore((s) => s.stopStreaming)
  const isStreaming = useMercuryStore((s) => s.isStreaming)
  const privilegeMode = usePrivilegeStore((s) => s.isEnabled)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [selectedPersona, setSelectedPersona] = useState<string>('cpo')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const currentPersona = PERSONAS.find((p) => p.id === selectedPersona) || PERSONAS[0]
  const CurrentIcon = currentPersona.Icon

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

  // Voice input handlers
  const handleVoiceTranscript = useCallback((text: string) => {
    // Update input with live transcript
    setInputValue(text)
  }, [setInputValue])

  const handleVoiceSubmit = useCallback((text: string) => {
    // Auto-submit when voice input is finalized
    setInputValue(text)
    // Small delay to ensure state is updated before sending
    setTimeout(() => {
      sendMessage(privilegeMode)
    }, 50)
  }, [setInputValue, sendMessage, privilegeMode])

  const canSend = inputValue.trim().length > 0 && !isStreaming

  const executivePersonas = PERSONAS.filter((p) => p.category === 'EXECUTIVE')
  const compliancePersonas = PERSONAS.filter((p) => p.category === 'COMPLIANCE')

  return (
    <div className="shrink-0 border-t border-[var(--border-default)] border-t-white/10 bg-[var(--bg-secondary)] px-4 py-3">
      {/* Persona Selector - Above input */}
      <div className="mb-3 flex justify-center">
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`
              flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
              ${currentPersona.isWhistleblower
                ? 'bg-amber-900/30 border border-amber-500/50 text-amber-400 hover:bg-amber-900/50'
                : 'bg-slate-800/50 border border-slate-700/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
              }
            `}
          >
            <CurrentIcon
              size={18}
              color={currentPersona.isWhistleblower ? '#FBBF24' : '#C0C0C0'}
            />
            <span>Viewing as: {currentPersona.label}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown */}
          {isDropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 bg-[#0B1221]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 py-2 overflow-hidden">
                {/* Executive Section */}
                <div className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-white/5">
                  Executive Leadership
                </div>
                {executivePersonas.map((persona) => {
                  const Icon = persona.Icon
                  return (
                    <button
                      key={persona.id}
                      onClick={() => { setSelectedPersona(persona.id); setIsDropdownOpen(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors ${
                        persona.id === selectedPersona ? 'bg-[var(--brand-blue)]/10' : ''
                      }`}
                    >
                      <Icon
                        size={20}
                        color={persona.id === selectedPersona ? '#60A5FA' : '#C0C0C0'}
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${persona.id === selectedPersona ? 'text-[var(--brand-blue)]' : 'text-slate-300'}`}>
                          {persona.label}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{persona.description}</div>
                      </div>
                      {persona.id === selectedPersona && (
                        <span className="text-[var(--brand-blue)] text-sm">✓</span>
                      )}
                    </button>
                  )
                })}

                <div className="border-t border-white/5 my-1" />

                {/* Compliance Section */}
                <div className="px-4 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Compliance & Oversight
                </div>
                {compliancePersonas.map((persona) => {
                  const Icon = persona.Icon
                  const isSelected = persona.id === selectedPersona
                  const iconColor = persona.isWhistleblower
                    ? (isSelected ? '#FBBF24' : '#D97706')
                    : (isSelected ? '#60A5FA' : '#C0C0C0')

                  return (
                    <button
                      key={persona.id}
                      onClick={() => { setSelectedPersona(persona.id); setIsDropdownOpen(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors ${
                        isSelected
                          ? persona.isWhistleblower
                            ? 'bg-amber-900/20'
                            : 'bg-[var(--brand-blue)]/10'
                          : ''
                      }`}
                    >
                      <Icon size={20} color={iconColor} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${
                            isSelected
                              ? persona.isWhistleblower ? 'text-amber-400' : 'text-[var(--brand-blue)]'
                              : persona.isWhistleblower ? 'text-amber-400/80' : 'text-slate-300'
                          }`}>
                            {persona.label}
                          </span>
                          {persona.isWhistleblower && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          )}
                        </div>
                        <div className={`text-xs truncate ${persona.isWhistleblower ? 'text-amber-500/60' : 'text-slate-500'}`}>
                          {persona.description}
                        </div>
                      </div>
                      {isSelected && (
                        <span className={persona.isWhistleblower ? 'text-amber-400 text-sm' : 'text-[var(--brand-blue)] text-sm'}>✓</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="flex items-end gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-tertiary)] px-3 py-2 focus-within:border-[var(--brand-blue)] focus-within:ring-2 focus-within:ring-[var(--brand-blue)]/50 focus-within:shadow-[0_0_30px_-5px_rgba(36,99,235,0.4)] transition-all duration-300">
        {/* Voice Trigger - HAL 9000 Style */}
        <VoiceTrigger
          onTranscript={handleVoiceTranscript}
          onSubmit={handleVoiceSubmit}
          disabled={isStreaming}
          className="shrink-0"
        />

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
