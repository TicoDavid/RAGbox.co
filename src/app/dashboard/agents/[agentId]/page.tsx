'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Loader2,
  Mail,
  MessageCircle,
  Mic,
  Send,
  FileSearch,
  Clock,
  ArrowRight,
  CheckCircle,
  Circle,
  AlertCircle,
  RotateCcw,
  ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { MercuryChannel } from '@/types/ragbox'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Persona {
  id: string
  firstName: string
  lastName: string
  title: string | null
  personalityPrompt: string
  greeting: string | null
}

interface EmailStatus {
  connected: boolean
  emailAddress?: string
  provider?: string
  isActive?: boolean
}

interface ThreadMessage {
  id: string
  role: 'user' | 'assistant'
  channel: MercuryChannel
  content: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Channel Icon helper
// ---------------------------------------------------------------------------

function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  switch (channel) {
    case 'whatsapp':
      return <MessageCircle className={className} />
    case 'voice':
      return <Mic className={className} />
    default:
      return <Mail className={className} />
  }
}

// ---------------------------------------------------------------------------
// Agent Identity Card
// ---------------------------------------------------------------------------

function AgentIdentityCard({ persona }: { persona: Persona }) {
  const initials = `${persona.firstName.charAt(0)}${persona.lastName.charAt(0)}`

  return (
    <motion.section
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0A192F] via-[#112240] to-[#0A192F] p-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Subtle radial glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-[var(--brand-blue)]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex items-center gap-6">
        {/* Avatar */}
        <div className="shrink-0 w-20 h-20 rounded-full bg-gradient-to-br from-[#1e3a5f] to-[#0f2744] border-2 border-amber-500/30 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.15)]">
          <span className="text-2xl font-bold text-amber-400/90 tracking-wider font-[var(--font-space)]">
            {initials}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {persona.firstName} {persona.lastName}
            </h1>
            {/* Active badge */}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-medium text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active
            </span>
          </div>
          <p className="text-sm text-slate-400 mb-2">
            {persona.title || 'Executive Assistant'}
          </p>
          <p className="text-sm text-slate-500 italic">
            &ldquo;Your documents. Your voice. Your advocate.&rdquo;
          </p>
        </div>
      </div>
    </motion.section>
  )
}

// ---------------------------------------------------------------------------
// Channel Status Card
// ---------------------------------------------------------------------------

interface ChannelCardProps {
  icon: React.ReactNode
  label: string
  provider: string
  connected: boolean
  comingSoon?: boolean
  detail?: string
  actionLabel?: string
  onAction?: () => void
}

function ChannelCard({ icon, label, provider, connected, comingSoon, detail, actionLabel, onAction }: ChannelCardProps) {
  return (
    <motion.div
      className={cn(
        'flex-1 min-w-[200px] rounded-xl border p-5 transition-colors',
        comingSoon
          ? 'border-white/5 bg-white/[0.01] opacity-75'
          : connected
            ? 'border-emerald-500/20 bg-emerald-500/5'
            : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center',
          comingSoon
            ? 'bg-white/5 text-slate-600'
            : connected
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-white/5 text-slate-500'
        )}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs text-slate-500">{provider}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        {comingSoon ? (
          <span className="text-xs text-slate-600 italic">Voice coming soon</span>
        ) : connected ? (
          <>
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">Connected</span>
          </>
        ) : (
          <>
            <Circle className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs text-slate-500">Not Connected</span>
          </>
        )}
      </div>

      {detail && (
        <p className="text-xs text-slate-400 font-mono truncate mb-3">{detail}</p>
      )}

      {!comingSoon && actionLabel && onAction && (
        <button
          onClick={onAction}
          className={cn(
            'w-full py-2 rounded-lg text-xs font-medium transition-all duration-200',
            connected
              ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
              : 'bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-hover)]'
          )}
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Inline Error Component
// ---------------------------------------------------------------------------

function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5">
      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
      <p className="text-sm text-red-300 flex-1">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-300 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Retry
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton Components (loading placeholders)
// ---------------------------------------------------------------------------

function ChannelCardSkeleton() {
  return (
    <div className="flex-1 min-w-[200px] rounded-xl border border-white/5 bg-white/[0.02] p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-white/5" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-16 rounded bg-white/5" />
          <div className="h-2.5 w-12 rounded bg-white/[0.03]" />
        </div>
      </div>
      <div className="h-3 w-24 rounded bg-white/5 mb-3" />
      <div className="h-8 w-full rounded-lg bg-white/5" />
    </div>
  )
}

function ActivityFeedSkeleton() {
  return (
    <div className="space-y-1 animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3 px-3 py-2.5">
          <div className="w-4 h-4 rounded bg-white/5 mt-0.5 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 rounded bg-white/5" style={{ width: `${70 - i * 8}%` }} />
            <div className="h-2.5 w-24 rounded bg-white/[0.03]" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Recent Activity Feed
// ---------------------------------------------------------------------------

function RecentActivityFeed({ messages }: { messages: ThreadMessage[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--brand-blue)]/10 flex items-center justify-center mb-4">
          <MessageCircle className="w-7 h-7 text-[var(--brand-blue)]/50" />
        </div>
        <p className="text-sm text-slate-400 font-medium">Evelyn is ready.</p>
        <p className="text-xs text-slate-600 mt-1">Send her first message.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {messages.map((msg) => {
        const time = new Date(msg.createdAt)
        const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const dateStr = time.toLocaleDateString([], { month: 'short', day: 'numeric' })

        return (
          <div
            key={msg.id}
            className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.03] transition-colors"
          >
            <ChannelIcon
              channel={msg.channel || 'dashboard'}
              className="w-4 h-4 text-slate-500 mt-0.5 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-300 truncate">{msg.content}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                {msg.role === 'assistant' ? 'Evelyn' : 'You'} &middot; {dateStr} {timeStr}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Quick Actions Panel
// ---------------------------------------------------------------------------

interface QuickActionsProps {
  onCompose: (channel: 'email' | 'whatsapp') => void
  onAsk: () => void
  onAudit: () => void
  actionLoading: string | null
}

function QuickActions({ onCompose, onAsk, onAudit, actionLoading }: QuickActionsProps) {
  const actions = [
    {
      id: 'email',
      label: 'Send Email',
      icon: <Mail className="w-4 h-4" />,
      onClick: () => onCompose('email'),
      color: 'bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white',
    },
    {
      id: 'whatsapp',
      label: 'Send WhatsApp',
      icon: <MessageCircle className="w-4 h-4" />,
      onClick: () => onCompose('whatsapp'),
      color: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    },
    {
      id: 'ask',
      label: 'Ask Evelyn',
      icon: <Send className="w-4 h-4" />,
      onClick: onAsk,
      color: 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20',
    },
  ]

  return (
    <div className="space-y-2">
      {actions.map((action) => {
        const isLoading = actionLoading === action.id
        const isDisabled = actionLoading !== null

        return (
          <button
            key={action.id}
            onClick={action.onClick}
            disabled={isDisabled}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
              action.color,
              isDisabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : action.icon}
            <span>{action.label}</span>
          </button>
        )
      })}

      <button
        onClick={onAudit}
        disabled={actionLoading !== null}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-200 group',
          actionLoading !== null && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="flex items-center gap-3">
          <FileSearch className="w-4 h-4" />
          View Audit Trail
        </span>
        <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AgentPage() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.agentId as string

  const [persona, setPersona] = useState<Persona | null>(null)
  const [emailStatus, setEmailStatus] = useState<EmailStatus>({ connected: false })
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [emailLoading, setEmailLoading] = useState(true)
  const [feedLoading, setFeedLoading] = useState(true)

  // Error states (3b)
  const [personaError, setPersonaError] = useState<string | null>(null)
  const [personaNotFound, setPersonaNotFound] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [feedError, setFeedError] = useState<string | null>(null)

  // Action loading state (3c)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const loadPersona = useCallback(async () => {
    setLoading(true)
    setPersonaError(null)
    setPersonaNotFound(false)
    try {
      const res = await apiFetch('/api/persona')
      if (res.status === 404) {
        setPersonaNotFound(true)
        return
      }
      if (!res.ok) {
        setPersonaError('Unable to load agent profile. Check your connection.')
        return
      }
      const data = await res.json()
      setPersona(data.data?.persona ?? null)
    } catch {
      setPersonaError('Unable to load agent profile. Check your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadEmail = useCallback(async () => {
    setEmailLoading(true)
    setEmailError(null)
    try {
      const res = await apiFetch(`/api/agent/${agentId}/email`)
      if (!res.ok) {
        setEmailError('Status unavailable')
        return
      }
      const data = await res.json()
      setEmailStatus(data)
    } catch {
      setEmailError('Status unavailable')
    } finally {
      setEmailLoading(false)
    }
  }, [agentId])

  const loadFeed = useCallback(async () => {
    setFeedLoading(true)
    setFeedError(null)
    try {
      const res = await apiFetch('/api/mercury/thread')
      if (!res.ok) {
        setFeedError('Unable to load activity')
        return
      }
      const threadData = await res.json()
      const threadId = threadData.data?.id
      if (threadId) {
        const msgRes = await apiFetch(
          `/api/mercury/thread/messages?threadId=${threadId}&limit=10`
        )
        if (!msgRes.ok) {
          setFeedError('Unable to load activity')
          return
        }
        const msgData = await msgRes.json()
        setMessages(msgData.data?.messages || [])
      }
    } catch {
      setFeedError('Unable to load activity')
    } finally {
      setFeedLoading(false)
    }
  }, [])

  useEffect(() => {
    // Fire all three in parallel — each manages its own loading state
    loadPersona()
    loadEmail()
    loadFeed()
  }, [loadPersona, loadEmail, loadFeed])

  const handleConnectEmail = async () => {
    setActionLoading('email')
    try {
      const res = await apiFetch(`/api/agent/${agentId}/email/connect`)
      if (!res.ok) {
        toast.error('Failed to start email connection. Please try again.')
        return
      }
      const data = await res.json()
      toast.success('Redirecting to email authorization...')
      window.location.href = data.url
    } catch {
      toast.error('Failed to start email connection. Check your network.')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCompose = (channel: 'email' | 'whatsapp') => {
    setActionLoading(channel)
    toast.success(`Opening ${channel === 'email' ? 'email' : 'WhatsApp'} composer...`)
    router.push(`/dashboard?compose=${channel}`)
  }

  const handleAsk = () => {
    setActionLoading('ask')
    router.push('/dashboard')
  }

  const handleAudit = () => {
    router.push('/dashboard/audit')
  }

  // Loading state — show skeleton layout instead of blank spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          {/* Identity skeleton */}
          <div className="rounded-2xl border border-white/10 bg-[var(--bg-secondary)] p-8 animate-pulse">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-white/5" />
              <div className="space-y-2 flex-1">
                <div className="h-6 w-48 rounded bg-white/5" />
                <div className="h-3.5 w-32 rounded bg-white/[0.03]" />
                <div className="h-3 w-64 rounded bg-white/[0.03]" />
              </div>
            </div>
          </div>
          {/* Channel skeletons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <ChannelCardSkeleton />
            <ChannelCardSkeleton />
            <ChannelCardSkeleton />
          </div>
          {/* Feed + actions skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-[var(--bg-secondary)] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/5">
                <div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
              </div>
              <div className="p-3">
                <ActivityFeedSkeleton />
              </div>
            </div>
            <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[var(--bg-secondary)] p-4 animate-pulse">
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-11 rounded-xl bg-white/5" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 3d — Not-found state (404 from persona endpoint)
  if (personaNotFound) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--bg-primary)] text-center px-6">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
          <Clock className="w-8 h-8 text-slate-600" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Agent not found</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          This agent doesn&apos;t exist or hasn&apos;t been configured yet.
        </p>
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand-blue)] text-white text-sm font-medium hover:bg-[var(--brand-blue-hover)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  // 3b — Persona fetch error (non-404)
  if (personaError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--bg-primary)] text-center px-6">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Unable to load agent profile</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Check your connection and try again.
        </p>
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={loadPersona}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand-blue)] text-white text-sm font-medium hover:bg-[var(--brand-blue-hover)] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Try again
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  // Fallback if persona didn't load (shouldn't reach here normally)
  if (!persona) {
    return null
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* TOP — Agent Identity Card */}
        <AgentIdentityCard persona={persona} />

        {/* MIDDLE — Channel Status Row */}
        <motion.section
          className="flex flex-col sm:flex-row gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          {emailLoading ? (
            <ChannelCardSkeleton />
          ) : emailError ? (
            <div className="flex-1 min-w-[200px] rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Email</p>
                  <p className="text-xs text-slate-500">Gmail</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs text-red-300">{emailError}</span>
              </div>
              <button
                onClick={loadEmail}
                className="w-full py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/20 transition-colors inline-flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                Retry
              </button>
            </div>
          ) : (
            <ChannelCard
              icon={<Mail className="w-5 h-5" />}
              label="Email"
              provider="Gmail"
              connected={emailStatus.connected}
              detail={emailStatus.emailAddress}
              actionLabel={emailStatus.connected ? 'Compose Email' : 'Connect Gmail'}
              onAction={emailStatus.connected ? () => handleCompose('email') : handleConnectEmail}
            />
          )}
          <ChannelCard
            icon={<MessageCircle className="w-5 h-5" />}
            label="WhatsApp"
            provider="WhatsApp Business"
            connected={false}
            actionLabel="Connect"
          />
          <ChannelCard
            icon={<Mic className="w-5 h-5" />}
            label="Voice"
            provider="Mercury Voice"
            connected={false}
            comingSoon
          />
        </motion.section>

        {/* BOTTOM — Two columns */}
        <motion.section
          className="grid grid-cols-1 lg:grid-cols-5 gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          {/* Left: Recent Activity Feed */}
          <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-[var(--bg-secondary)] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Recent Activity
              </h2>
            </div>
            <div className="p-3 max-h-[400px] overflow-y-auto">
              {feedLoading ? (
                <ActivityFeedSkeleton />
              ) : feedError ? (
                <div className="p-3">
                  <InlineError message={feedError} onRetry={loadFeed} />
                </div>
              ) : (
                <RecentActivityFeed messages={messages} />
              )}
            </div>
          </div>

          {/* Right: Quick Actions */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[var(--bg-secondary)] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center gap-2">
              <Send className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                Quick Actions
              </h2>
            </div>
            <div className="p-4">
              <QuickActions
                onCompose={handleCompose}
                onAsk={handleAsk}
                onAudit={handleAudit}
                actionLoading={actionLoading}
              />
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  )
}
