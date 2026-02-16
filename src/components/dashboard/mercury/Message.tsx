'use client'

import React from 'react'
import type { ChatMessage, MercuryChannel } from '@/types/ragbox'
import { CitationTag } from './CitationTag'
import { ConfidenceBadge } from './ConfidenceBadge'

interface MessageProps {
  message: ChatMessage
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

const CHANNEL_BADGE: Record<MercuryChannel, { label: string; color: string }> = {
  dashboard: { label: 'Dashboard', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  whatsapp: { label: 'WhatsApp', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  voice: { label: 'Voice', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  roam: { label: 'ROAM', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
}

function ChannelBadge({ channel }: { channel?: MercuryChannel }) {
  if (!channel) return null
  const badge = CHANNEL_BADGE[channel]
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border ${badge.color}`}>
      {badge.label}
    </span>
  )
}

export function Message({ message }: MessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`max-w-[75%] rounded-xl px-4 py-3 ${
          isUser
            ? 'bg-[var(--brand-blue)] text-white'
            : message.isError
              ? 'bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--text-primary)]'
              : 'bg-[var(--bg-secondary)] border border-[var(--border-default)] text-[var(--text-primary)]'
        }`}
      >
        {/* Content */}
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
        </div>

        {/* Citations */}
        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-[var(--border-subtle)]">
            {message.citations.map((citation) => (
              <CitationTag key={citation.citationIndex} citation={citation} />
            ))}
          </div>
        )}

        {/* Footer: time + channel badge + confidence */}
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-[10px] ${isUser ? 'text-white/60' : 'text-[var(--text-tertiary)]'}`}>
            {formatTime(message.timestamp)}
          </span>
          <ChannelBadge channel={message.channel} />
          {message.confidence !== undefined && !isUser && (
            <ConfidenceBadge confidence={message.confidence} />
          )}
        </div>
      </div>
    </div>
  )
}
