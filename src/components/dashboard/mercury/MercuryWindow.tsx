'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  MessageSquare,
  Mic,
  Mail,
  MessageCircle,
  Settings,
} from 'lucide-react'
import { MercuryPanel } from './MercuryPanel'
import { MercuryVoicePanel } from './MercuryVoicePanel'
import { MercuryConfigModal } from './MercuryConfigModal'

// ============================================================================
// TYPES
// ============================================================================

type MercuryTab = 'chat' | 'voice' | 'email' | 'whatsapp'

interface TabDef {
  id: MercuryTab
  label: string
  icon: React.ElementType
}

const TABS: TabDef[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'voice', label: 'Voice', icon: Mic },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
]

// ============================================================================
// CHANNEL PLACEHOLDERS
// ============================================================================

function EmailPlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-full bg-[var(--brand-blue)]/10 flex items-center justify-center mb-4">
        <Mail className="w-7 h-7 text-[var(--brand-blue)]/50" />
      </div>
      <p className="text-sm font-medium text-[var(--text-secondary)]">Email Channel</p>
      <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-xs">
        Send and receive emails as your agent. Connect Gmail to get started.
      </p>
    </div>
  )
}

function WhatsAppPlaceholder() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
      <div className="w-16 h-16 rounded-full bg-[var(--success)]/10 flex items-center justify-center mb-4">
        <MessageCircle className="w-7 h-7 text-[var(--success)]/50" />
      </div>
      <p className="text-sm font-medium text-[var(--text-secondary)]">WhatsApp Channel</p>
      <p className="text-xs text-[var(--text-tertiary)] mt-1 max-w-xs">
        Connect WhatsApp Business to let your agent handle conversations.
      </p>
    </div>
  )
}

// ============================================================================
// MERCURY WINDOW
// ============================================================================

export function MercuryWindow() {
  const [activeTab, setActiveTab] = useState<MercuryTab>('chat')
  const [configOpen, setConfigOpen] = useState(false)
  const [agentName, setAgentName] = useState('Evelyn Monroe')
  const [agentTitle, setAgentTitle] = useState('AI Assistant')

  // Load agent identity from config on mount
  const loadIdentity = useCallback(async () => {
    try {
      const res = await fetch('/api/mercury/config')
      if (!res.ok) return
      const json = await res.json()
      if (json.success && json.data?.config) {
        setAgentName(json.data.config.name || 'Evelyn Monroe')
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

      {/* ─── Channel Tabs ─── */}
      <div className="shrink-0 flex items-center gap-1 px-4 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                transition-all duration-200
                ${isActive
                  ? 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50'
                }
              `}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ─── Tab Content ─── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'chat' && <MercuryPanel />}
        {activeTab === 'voice' && <MercuryVoicePanel />}
        {activeTab === 'email' && <EmailPlaceholder />}
        {activeTab === 'whatsapp' && <WhatsAppPlaceholder />}
      </div>

      {/* ─── Config Modal ─── */}
      <MercuryConfigModal
        isOpen={configOpen}
        onClose={() => setConfigOpen(false)}
        onSaved={({ name, title }) => {
          setAgentName(name || 'Evelyn Monroe')
          setAgentTitle(title || 'AI Assistant')
        }}
      />
    </div>
  )
}
