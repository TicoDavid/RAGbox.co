'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Settings } from 'lucide-react'
import { MercuryPanel } from './MercuryPanel'
import { MercurySettingsModal } from './MercurySettingsModal'

// ============================================================================
// MERCURY WINDOW
// ============================================================================

export function MercuryWindow() {
  const [configOpen, setConfigOpen] = useState(false)
  const [agentName, setAgentName] = useState('Mercury')
  const [agentTitle, setAgentTitle] = useState('AI Assistant')

  // Load agent identity from config on mount
  const loadIdentity = useCallback(async () => {
    try {
      const res = await fetch('/api/mercury/config')
      if (!res.ok) return
      const json = await res.json()
      if (json.success && json.data?.config) {
        setAgentName(json.data.config.name || 'Mercury')
        setAgentTitle(json.data.config.title || 'AI Assistant')
      }
    } catch { /* use defaults */ }
  }, [])

  useEffect(() => { loadIdentity() }, [loadIdentity])

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)] overflow-hidden">
      {/* ─── Header ─── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)]">
        {/* Agent identity */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-primary)] border border-[var(--border-strong)] flex items-center justify-center">
            <span className="text-xs font-bold text-[var(--warning)]/90">
              {agentName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                {agentName}
              </h2>
              {/* Online indicator */}
              <span className="shrink-0 flex items-center gap-1.5">
                <span className="relative w-2 h-2 rounded-full bg-[var(--success)]">
                  <span className="absolute inset-0 rounded-full bg-[var(--success)] animate-ping opacity-75" />
                </span>
                <span className="text-[10px] font-medium text-[var(--success)]">Online</span>
              </span>
            </div>
          </div>
        </div>

        {/* Gear icon */}
        <button
          onClick={() => setConfigOpen(true)}
          aria-label="Mercury configuration"
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg rail-icon-glow
                     text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* ─── Chat Panel ─── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <MercuryPanel />
      </div>

      {/* ─── Settings Modal ─── */}
      <MercurySettingsModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onSaved={({ name, title }) => {
          setAgentName(name || 'Mercury')
          setAgentTitle(title || 'AI Assistant')
        }}
      />
    </div>
  )
}
