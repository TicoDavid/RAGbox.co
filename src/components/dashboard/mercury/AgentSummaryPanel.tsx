'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { UserCircle, ExternalLink, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface AgentInfo {
  id: string
  firstName: string
  lastName: string
  title: string | null
  greeting: string | null
}

export function AgentSummaryPanel() {
  const [agent, setAgent] = useState<AgentInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch('/api/persona')
        if (res.ok) {
          const data = await res.json()
          const persona = data.data?.persona
          if (persona?.id) {
            setAgent({
              id: persona.id,
              firstName: persona.firstName || 'Agent',
              lastName: persona.lastName || '',
              title: persona.title || null,
              greeting: persona.greeting || null,
            })
          }
        }
      } catch {
        // Silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="h-full flex flex-col bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">My Agent</h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-[var(--text-tertiary)] animate-spin" />
          </div>
        ) : agent ? (
          <div className="space-y-4">
            {/* Agent Card */}
            <div className="p-4 rounded-xl bg-[var(--bg-elevated)]/30 border border-[var(--border-default)]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--brand-blue)]/30 to-[var(--brand-blue-dim)]/30 border border-[var(--brand-blue)]/40 flex items-center justify-center">
                  <UserCircle className="w-6 h-6 text-[var(--brand-blue)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    {agent.firstName} {agent.lastName}
                  </p>
                  {agent.title && (
                    <p className="text-xs text-[var(--text-secondary)]">{agent.title}</p>
                  )}
                </div>
                <span className="ml-auto w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
              </div>

              {agent.greeting && (
                <p className="text-xs text-[var(--text-secondary)] italic leading-relaxed">
                  &ldquo;{agent.greeting}&rdquo;
                </p>
              )}
            </div>

            {/* Link to full page */}
            <Link
              href={`/dashboard/agents/${agent.id}`}
              className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-elevated)]/30 border border-[var(--border-default)]
                       hover:border-[var(--brand-blue)]/30 hover:bg-[var(--brand-blue)]/5 transition-all group"
            >
              <span className="text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">Open Agent Profile</span>
              <ExternalLink className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--brand-blue)]" />
            </Link>
          </div>
        ) : (
          <div className="text-center py-12">
            <UserCircle className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-secondary)] mb-1">No Agent Configured</p>
            <p className="text-xs text-[var(--text-tertiary)]">
              Create an agent to enable multi-channel AI conversations.
            </p>
            <Link
              href="/dashboard/agents"
              className="inline-block mt-4 px-4 py-2 text-xs font-medium text-[var(--brand-blue)]
                       bg-[var(--brand-blue)]/10 rounded-lg hover:bg-[var(--brand-blue)]/20 transition-colors"
            >
              Set Up Agent
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
