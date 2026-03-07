'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  ChevronDown,
  Check,
  AlertTriangle,
  Glasses,
} from 'lucide-react'
import { useMercuryStore } from '@/stores/mercuryStore'
import { PERSONAS } from '../mercury/personaData'

export function PersonaSelector() {
  const activePersona = useMercuryStore((s) => s.activePersona)
  const setPersona = useMercuryStore((s) => s.setPersona)
  const [personaMenuOpen, setPersonaMenuOpen] = useState(false)
  const [hoveredPersona, setHoveredPersona] = useState<string | null>(null)
  const personaMenuRef = useRef<HTMLDivElement>(null)

  const currentPersona = PERSONAS.find((p) => p.id === activePersona) || PERSONAS[0]
  const CurrentPersonaIcon = currentPersona.Icon
  const isWhistleblowerMode = currentPersona.isWhistleblower

  const executivePersonas = PERSONAS.filter((p) => p.category === 'EXECUTIVE')
  const compliancePersonas = PERSONAS.filter((p) => p.category === 'COMPLIANCE')

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (personaMenuRef.current && !personaMenuRef.current.contains(e.target as Node)) {
        setPersonaMenuOpen(false)
        setHoveredPersona(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative group/lens" ref={personaMenuRef}>
      <button
        onClick={() => setPersonaMenuOpen(!personaMenuOpen)}
        aria-label={`Select persona: ${currentPersona.label}`}
        aria-expanded={personaMenuOpen}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300
          ${isWhistleblowerMode
            ? 'bg-[var(--warning)]/10 border border-[var(--warning)]/50 text-[var(--warning)] hover:bg-[var(--warning)]/20 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
            : 'bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50 hover:border-[var(--border-default)]'
          }
        `}
      >
        {isWhistleblowerMode ? (
          <span className="w-2 h-2 rounded-full bg-[var(--danger)] animate-ping" />
        ) : (
          <Glasses className="w-4 h-4" />
        )}
        <CurrentPersonaIcon
          size={16}
          color={isWhistleblowerMode ? 'var(--warning)' : 'var(--text-tertiary)'}
        />
        <span className="hidden lg:inline text-xs">{currentPersona.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${personaMenuOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* CEO Lens Tooltip */}
      {!personaMenuOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-[var(--bg-primary)]/95 backdrop-blur-xl border border-[var(--border-default)] rounded-lg shadow-2xl opacity-0 invisible group-hover/lens:opacity-100 group-hover/lens:visible transition-all duration-200 z-50 pointer-events-none">
          <div className="flex items-center gap-2 mb-2">
            <CurrentPersonaIcon size={16} color={isWhistleblowerMode ? 'var(--warning)' : 'var(--brand-blue)'} />
            <span className={`text-sm font-semibold ${isWhistleblowerMode ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}`}>
              CEO Lens: {currentPersona.label}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {currentPersona.description}. Switch personas to change how Mercury analyzes your documents.
          </p>
          <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] text-[10px] text-[var(--text-tertiary)]">
            Click to switch lens
          </div>
        </div>
      )}

      {/* Persona Dropdown */}
      {personaMenuOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--bg-primary)]/98 backdrop-blur-xl border border-[var(--border-default)] rounded-xl shadow-2xl z-50 py-2 overflow-hidden">
          {/* System Prompt Preview (on hover) */}
          {hoveredPersona && (
            <div className="px-4 py-3 bg-[var(--bg-primary)]/80 border-b border-[var(--border-default)]">
              <p className="text-[10px] font-semibold text-[var(--brand-blue)] uppercase tracking-wider mb-1">
                System Instruction
              </p>
              <p className="text-xs text-[var(--text-secondary)] italic">
                &quot;{PERSONAS.find(p => p.id === hoveredPersona)?.systemPrompt}&quot;
              </p>
            </div>
          )}

          {/* Executive Section */}
          <div className="px-4 py-2 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider border-b border-[var(--border-subtle)]">
            Executive Leadership
          </div>
          {executivePersonas.map((persona) => {
            const Icon = persona.Icon
            const isSelected = persona.id === activePersona
            return (
              <button
                key={persona.id}
                onClick={() => { setPersona(persona.id as typeof activePersona); setPersonaMenuOpen(false); setHoveredPersona(null) }}
                onMouseEnter={() => setHoveredPersona(persona.id)}
                onMouseLeave={() => setHoveredPersona(null)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--bg-elevated)]/30 transition-colors ${
                  isSelected ? 'bg-[var(--brand-blue)]/10' : ''
                }`}
              >
                <Icon
                  size={18}
                  color={isSelected ? 'var(--brand-blue-hover)' : 'var(--text-tertiary)'}
                />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${isSelected ? 'text-[var(--brand-blue)]' : 'text-[var(--text-secondary)]'}`}>
                    {persona.label}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)] truncate">{persona.description}</div>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-[var(--brand-blue)]" />
                )}
              </button>
            )
          })}

          <div className="border-t border-[var(--border-subtle)] my-1" />

          {/* Compliance Section */}
          <div className="px-4 py-2 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
            Compliance & Oversight
          </div>
          {compliancePersonas.map((persona) => {
            const Icon = persona.Icon
            const isSelected = persona.id === activePersona
            const iconColor = persona.isWhistleblower
              ? (isSelected ? 'var(--warning)' : 'var(--warning-dim, #b45309)')
              : (isSelected ? 'var(--brand-blue-hover)' : 'var(--text-tertiary)')

            return (
              <button
                key={persona.id}
                onClick={() => { setPersona(persona.id as typeof activePersona); setPersonaMenuOpen(false); setHoveredPersona(null) }}
                onMouseEnter={() => setHoveredPersona(persona.id)}
                onMouseLeave={() => setHoveredPersona(null)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--bg-elevated)]/30 transition-colors ${
                  isSelected
                    ? persona.isWhistleblower
                      ? 'bg-[var(--warning)]/10'
                      : 'bg-[var(--brand-blue)]/10'
                    : ''
                }`}
              >
                <Icon size={18} color={iconColor} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${
                      isSelected
                        ? persona.isWhistleblower ? 'text-[var(--warning)]' : 'text-[var(--brand-blue)]'
                        : persona.isWhistleblower ? 'text-[var(--warning)]/80' : 'text-[var(--text-secondary)]'
                    }`}>
                      {persona.label}
                    </span>
                    {persona.isWhistleblower && (
                      <AlertTriangle className="w-3.5 h-3.5 text-[var(--warning)]" />
                    )}
                  </div>
                  <div className={`text-xs truncate ${persona.isWhistleblower ? 'text-[var(--warning)]/60' : 'text-[var(--text-tertiary)]'}`}>
                    {persona.description}
                  </div>
                </div>
                {isSelected && (
                  <Check className={persona.isWhistleblower ? 'w-4 h-4 text-[var(--warning)]' : 'w-4 h-4 text-[var(--brand-blue)]'} />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
