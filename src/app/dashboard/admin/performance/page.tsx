'use client'

/**
 * Admin Performance Dashboard — STORY-158 EPIC-013
 *
 * Shows RAG pipeline metrics: TTFB trends, component breakdown,
 * cache/skip rates, and summary cards. Admin-only (Partner role).
 */

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Activity, Zap, Database, Brain, Loader2, ShieldAlert } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────

interface DailyStats {
  date: string
  queries: number
  ttfb_p50: number
  ttfb_p95: number
  ttfb_p99: number
  avg_embed_ms: number
  avg_search_ms: number
  avg_generate_ms: number
  avg_selfrag_ms: number
  cache_hit_rate: number
  selfrag_skip_rate: number
}

interface Summary {
  totalQueries: number
  avgTtfb: number
  ttfb_p50: number
  ttfb_p95: number
  cacheHitRate: number
  selfragSkipRate: number
  queriesPerHour: number
}

interface PerformanceData {
  summary: Summary
  daily: DailyStats[]
}

// ── Main Page ─────────────────────────────────────────────────────

export default function PerformanceDashboard() {
  const { status } = useSession()
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/performance', { credentials: 'include' })
      if (res.status === 403) {
        setError('Admin access required')
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.success) {
        setData(json.data)
      } else {
        setError(json.error ?? 'Unknown error')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') redirect('/')
    if (status === 'authenticated') fetchData()
  }, [status, fetchData])

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <ShieldAlert className="w-12 h-12 text-[var(--danger)]" />
        <p className="text-lg text-[var(--text-secondary)]">{error}</p>
      </div>
    )
  }

  if (!data) return null

  const { summary, daily } = data

  // Format date labels to short format (e.g., "Feb 22")
  const chartData = daily.map((d) => ({
    ...d,
    label: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }))

  // TTFB health color
  const ttfbColor =
    summary.ttfb_p50 < 400 ? 'text-[var(--success)]' :
    summary.ttfb_p50 < 800 ? 'text-[var(--warning)]' :
    'text-[var(--danger)]'

  return (
    <div className="h-full overflow-auto bg-[var(--bg-primary)] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">
            Query Performance
          </h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            RAG pipeline metrics — last 7 days
          </p>
        </div>

        {/* Section 4 — Summary Cards (top row) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            icon={<Activity className="w-5 h-5" />}
            label="Total Queries"
            value={summary.totalQueries.toLocaleString()}
            sub="7 days"
          />
          <SummaryCard
            icon={<Zap className="w-5 h-5" />}
            label="Avg TTFB"
            value={`${summary.avgTtfb}ms`}
            sub={`P50: ${summary.ttfb_p50}ms`}
            valueClassName={ttfbColor}
          />
          <SummaryCard
            icon={<Database className="w-5 h-5" />}
            label="Cache Hit Rate"
            value={`${summary.cacheHitRate}%`}
            sub="Embedding cache"
          />
          <SummaryCard
            icon={<Brain className="w-5 h-5" />}
            label="SelfRAG Skip Rate"
            value={`${summary.selfragSkipRate}%`}
            sub={`${summary.queriesPerHour} q/hr`}
          />
        </div>

        {/* Section 1 — TTFB Trend */}
        <ChartCard title="TTFB Trend (7-day)" subtitle="Time to first byte — P50, P95, P99">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
                  tickFormatter={(v: number) => `${v}ms`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value?: number, name?: string) => [`${value ?? 0}ms`, name ?? '']}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line
                  type="monotone"
                  dataKey="ttfb_p50"
                  name="P50"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="ttfb_p95"
                  name="P95"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="ttfb_p99"
                  name="P99"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* Section 2 — Component Breakdown */}
        <ChartCard title="Component Breakdown" subtitle="Average latency by pipeline stage per day">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }} />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--text-tertiary)' }}
                  tickFormatter={(v: number) => `${v}ms`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-default)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value?: number, name?: string) => [`${value ?? 0}ms`, name ?? '']}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="avg_embed_ms" name="Embed" stackId="a" fill="#60a5fa" radius={[0, 0, 0, 0]} />
                <Bar dataKey="avg_search_ms" name="Search" stackId="a" fill="#34d399" />
                <Bar dataKey="avg_generate_ms" name="Generate" stackId="a" fill="#fbbf24" />
                <Bar dataKey="avg_selfrag_ms" name="SelfRAG" stackId="a" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>

        {/* Section 3 — Cache & Skip Rate Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RateCard
            label="Embedding Cache Hit Rate"
            value={summary.cacheHitRate}
            color="#34d399"
          />
          <RateCard
            label="SelfRAG Skip Rate"
            value={summary.selfragSkipRate}
            color="#60a5fa"
          />
          <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
            <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-2">
              Queries Per Hour
            </p>
            <p className="text-3xl font-bold text-[var(--text-primary)]">
              {summary.queriesPerHour}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Last 24 hours</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-Components ────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  sub,
  valueClassName = 'text-[var(--text-primary)]',
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  valueClassName?: string
}) {
  return (
    <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[var(--text-tertiary)]">{icon}</span>
        <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className={`text-2xl font-bold ${valueClassName}`}>{value}</p>
      <p className="text-xs text-[var(--text-tertiary)] mt-1">{sub}</p>
    </div>
  )
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
        <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function RateCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="p-5 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)]">
      <p className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-3">
        {label}
      </p>
      <div className="flex items-end gap-3">
        <p className="text-3xl font-bold text-[var(--text-primary)]">{value}%</p>
        <div className="flex-1 h-3 bg-[var(--bg-primary)] rounded-full overflow-hidden mb-1.5">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${value}%`, backgroundColor: color }}
          />
        </div>
      </div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div className="flex flex-col items-center justify-center h-[280px] text-[var(--text-tertiary)]">
      <Activity className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm">No query data yet</p>
      <p className="text-xs mt-1">Metrics will appear after queries are processed</p>
    </div>
  )
}
