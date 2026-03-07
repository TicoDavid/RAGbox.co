'use client'

import { Mic, Zap, MessageCircle, Brain, Users } from 'lucide-react'

const FEATURES = [
  { icon: Mic, label: 'Voice AI Agent', description: 'Real-time voice conversations with your documents' },
  { icon: Brain, label: 'Conversation Memory', description: 'Mercury remembers context across sessions' },
  { icon: MessageCircle, label: 'Multi-Channel', description: 'Chat, voice, WhatsApp, and email integrations' },
  { icon: Users, label: 'Neural Shift Personas', description: 'CEO, Legal, Compliance perspectives on demand' },
]

interface MercuryUpgradeCardProps {
  onUpgrade?: () => void
}

export function MercuryUpgradeCard({ onUpgrade }: MercuryUpgradeCardProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="max-w-sm w-full space-y-6">
        {/* Mercury Logo / Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--warning)]/20 to-[var(--warning)]/5 border border-[var(--warning)]/30 flex items-center justify-center mb-4">
            <Mic className="w-8 h-8 text-[var(--warning)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Mercury AI Assistant</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Your intelligent voice agent for document interrogation
          </p>
        </div>

        {/* Feature Bullets */}
        <div className="space-y-3">
          {FEATURES.map(({ icon: Icon, label, description }) => (
            <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)]">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-[var(--warning)]/10 flex items-center justify-center mt-0.5">
                <Icon className="w-4 h-4 text-[var(--warning)]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Button */}
        <button
          onClick={onUpgrade}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold
                     bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white
                     shadow-lg shadow-[var(--brand-blue)]/20 transition-all"
        >
          <Zap className="w-4 h-4" />
          Upgrade to Unlock Mercury
        </button>

        <p className="text-center text-[10px] text-[var(--text-tertiary)]">
          Available on Starter plan and above
        </p>
      </div>
    </div>
  )
}
