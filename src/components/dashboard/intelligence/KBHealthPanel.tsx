'use client'

import React, { useState, useEffect } from 'react'
import { Activity, Clock, Layers, CheckCircle2, AlertTriangle, XCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { useContentIntelligenceStore } from '@/stores/contentIntelligenceStore'
import type { KBHealthCheck } from '@/types/ragbox'

function statusIcon(status: KBHealthCheck['status']) {
  switch (status) {
    case 'passed':
      return <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />
    case 'failed':
      return <XCircle className="w-5 h-5 text-[var(--danger)]" />
  }
}

function statusBorder(status: KBHealthCheck['status']): string {
  switch (status) {
    case 'passed':
      return 'border-[var(--success)]/20'
    case 'warning':
      return 'border-[var(--warning)]/20'
    case 'failed':
      return 'border-[var(--danger)]/20'
  }
}

function formatCheckTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

interface KBHealthPanelProps {
  vaultId: string
}

export function KBHealthPanel({ vaultId }: KBHealthPanelProps) {
  const healthChecks = useContentIntelligenceStore((s) => s.healthChecks)
  const healthLoading = useContentIntelligenceStore((s) => s.healthLoading)
  const lastHealthRun = useContentIntelligenceStore((s) => s.lastHealthRun)
  const runHealthCheck = useContentIntelligenceStore((s) => s.runHealthCheck)
  const fetchHealthHistory = useContentIntelligenceStore((s) => s.fetchHealthHistory)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  useEffect(() => {
    fetchHealthHistory(vaultId)
  }, [fetchHealthHistory, vaultId])

  const latestFreshness = healthChecks.find((c) => c.checkType === 'freshness')
  const latestCoverage = healthChecks.find((c) => c.checkType === 'coverage')

  return (
    <div className="flex flex-col h-full">
      {/* Header + Run button */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--brand-blue)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">
            KB Health
          </h3>
        </div>
        <button
          onClick={() => runHealthCheck(vaultId)}
          disabled={healthLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg
                     bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] hover:bg-[var(--brand-blue)]/20 disabled:opacity-50
                     transition-colors"
        >
          {healthLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Activity className="w-3.5 h-3.5" />
          )}
          Run Check
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {lastHealthRun && (
          <p className="text-[10px] text-[var(--text-muted)] px-1">
            Last run: {formatCheckTime(lastHealthRun)}
          </p>
        )}

        {!latestFreshness && !latestCoverage && !healthLoading && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Activity className="w-10 h-10 text-[var(--text-muted)]/30 mb-3" />
            <p className="text-sm text-[var(--text-tertiary)]">
              No health checks yet. Run a check to see vault status.
            </p>
          </div>
        )}

        {healthLoading && !latestFreshness && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-[var(--brand-blue)] animate-spin" />
          </div>
        )}

        {/* Status cards */}
        <div className="grid grid-cols-2 gap-2">
          {latestFreshness && (
            <HealthCard
              check={latestFreshness}
              icon={<Clock className="w-4 h-4" />}
              label="Freshness"
              detail={
                latestFreshness.details.staleCount != null
                  ? `${String(latestFreshness.details.staleCount)} stale docs`
                  : undefined
              }
              isExpanded={expandedCard === 'freshness'}
              onToggle={() => setExpandedCard(expandedCard === 'freshness' ? null : 'freshness')}
            />
          )}
          {latestCoverage && (
            <HealthCard
              check={latestCoverage}
              icon={<Layers className="w-4 h-4" />}
              label="Coverage"
              detail={
                latestCoverage.details.unindexedCount != null
                  ? `${String(latestCoverage.details.unindexedCount)} unindexed`
                  : undefined
              }
              isExpanded={expandedCard === 'coverage'}
              onToggle={() => setExpandedCard(expandedCard === 'coverage' ? null : 'coverage')}
            />
          )}
        </div>

        {/* Expanded details */}
        {expandedCard === 'freshness' && Array.isArray(latestFreshness?.details.staleList) && (
          <div className="p-3 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Stale Documents</p>
            <div className="space-y-1">
              {(latestFreshness.details.staleList as string[]).map((name) => (
                <p key={name} className="text-xs text-[var(--text-tertiary)] truncate">{name}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface HealthCardProps {
  check: KBHealthCheck
  icon: React.ReactNode
  label: string
  detail?: string
  isExpanded: boolean
  onToggle: () => void
}

function HealthCard({ check, icon, label, detail, isExpanded, onToggle }: HealthCardProps) {
  return (
    <button
      onClick={onToggle}
      className={`flex flex-col items-center gap-2 p-3 rounded-xl bg-[var(--bg-secondary)] border ${statusBorder(check.status)} hover:bg-[var(--bg-elevated)]/50 transition-colors text-center w-full`}
    >
      {statusIcon(check.status)}
      <div className="flex items-center gap-1 text-[var(--text-secondary)]">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      {detail && (
        <p className="text-[10px] text-[var(--text-tertiary)]">{detail}</p>
      )}
      {Array.isArray(check.details.staleList) && (
        <div className="text-[var(--text-muted)]">
          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </div>
      )}
    </button>
  )
}
