'use client'

import type { MercuryChannel } from '@/types/ragbox'

const CHANNEL_CONFIG: Record<MercuryChannel, { emoji: string; label: string; color: string }> = {
  dashboard: { emoji: '\uD83D\uDCAC', label: 'Chat',     color: 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)]' },
  whatsapp:  { emoji: '\uD83D\uDCF1', label: 'WhatsApp', color: 'bg-[var(--success)]/15 text-[var(--success)]' },
  voice:     { emoji: '\uD83C\uDFA4', label: 'Voice',    color: 'bg-purple-500/15 text-purple-400' },
  email:     { emoji: '\uD83D\uDCE7', label: 'Email',    color: 'bg-[var(--warning)]/15 text-[var(--warning)]' },
  sms:       { emoji: '\uD83D\uDCAC', label: 'SMS',      color: 'bg-cyan-500/15 text-cyan-400' },
  roam:      { emoji: '\uD83D\uDFE0', label: 'ROAM',     color: 'bg-orange-500/15 text-orange-400' },
}

interface ChannelBadgeProps {
  channel?: MercuryChannel
}

export function ChannelBadge({ channel }: ChannelBadgeProps) {
  if (!channel || channel === 'dashboard') return null
  const cfg = CHANNEL_CONFIG[channel]
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${cfg.color}`}>
      <span>{cfg.emoji}</span>
      {cfg.label}
    </span>
  )
}
