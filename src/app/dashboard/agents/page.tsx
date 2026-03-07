'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Bot,
  Mic,
  Brain,
  ArrowRight,
  Loader2,
  AlertCircle,
  RotateCcw,
} from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface Persona {
  id: string
  firstName: string
  lastName: string
  title: string | null
  personalityPrompt: string
  greeting: string | null
}

export default function AgentsPage() {
  const router = useRouter()
  const [persona, setPersona] = useState<Persona | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadPersona = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await apiFetch('/api/persona')
      if (!res.ok) {
        setError('Unable to load agent profile.')
        return
      }
      const data = await res.json()
      setPersona(data.data?.persona ?? null)
    } catch {
      setError('Unable to load agent profile. Check your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPersona()
  }, [loadPersona])

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[var(--brand-blue)] animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-full bg-[var(--danger)]/10 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7 text-[var(--danger)]" />
        </div>
        <p className="text-sm text-[var(--text-tertiary)] mb-4">{error}</p>
        <button
          onClick={loadPersona}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--brand-blue)] text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--brand-blue-hover)] transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Retry
        </button>
      </div>
    )
  }

  const initials = persona
    ? `${persona.firstName.charAt(0)}${persona.lastName.charAt(0)}`
    : 'MA'

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight font-[var(--font-space)]">
            Agent Identity
          </h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            Mercury agent configuration &mdash; read-only preview
          </p>
        </motion.div>

        {/* Identity Card */}
        <motion.div
          className="relative overflow-hidden rounded-2xl border border-[var(--border-default)] bg-gradient-to-br from-[var(--bg-primary)] via-[var(--bg-secondary)] to-[var(--bg-primary)] p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-[var(--brand-blue)]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative flex items-center gap-6">
            <div className="shrink-0 w-20 h-20 rounded-full bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-primary)] border-2 border-[var(--warning)]/30 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.15)]">
              <span className="text-2xl font-bold text-[var(--warning)]/90 tracking-wider font-[var(--font-space)]">
                {initials}
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
                  {persona ? `${persona.firstName} ${persona.lastName}` : 'Mercury Agent'}
                </h2>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--success)]/15 border border-[var(--success)]/30 text-xs font-medium text-[var(--success)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                  Active
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">
                {persona?.title || 'Executive Assistant'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Detail Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Voice Card */}
          <motion.div
            className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--brand-blue)]/10 flex items-center justify-center">
                <Mic className="w-4 h-4 text-[var(--brand-blue)]" />
              </div>
              <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Voice</span>
            </div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Mercury TTS</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Default voice profile</p>
          </motion.div>

          {/* Personality Card */}
          <motion.div
            className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 sm:col-span-2"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--warning)]/10 flex items-center justify-center">
                <Brain className="w-4 h-4 text-[var(--warning)]" />
              </div>
              <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Personality</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-3">
              {persona?.personalityPrompt || 'Default Mercury personality — professional, precise, privacy-aware.'}
            </p>
          </motion.div>
        </div>

        {/* Greeting Card */}
        {persona?.greeting && (
          <motion.div
            className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Greeting</p>
            <p className="text-sm text-[var(--text-secondary)] italic">
              &ldquo;{persona.greeting}&rdquo;
            </p>
          </motion.div>
        )}

        {/* View Details Link */}
        {persona?.id && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            <button
              onClick={() => router.push(`/dashboard/agents/${persona.id}`)}
              className="inline-flex items-center gap-2 text-sm text-[var(--brand-blue)] hover:text-[var(--brand-blue-hover)] font-medium transition-colors"
            >
              View full agent details
              <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Future EPIC Notice */}
        <motion.div
          className="rounded-xl border border-dashed border-[var(--border-default)] bg-[var(--bg-elevated)]/5 p-5 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Bot className="w-6 h-6 text-[var(--text-tertiary)] mx-auto mb-2" />
          <p className="text-xs text-[var(--text-tertiary)]">
            Agent editing coming in EPIC-029 VERITAS CAST
          </p>
        </motion.div>
      </div>
    </div>
  )
}
