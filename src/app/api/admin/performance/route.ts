/**
 * Performance Dashboard API (Admin Only)
 *
 * GET /api/admin/performance — Returns aggregated RAG pipeline metrics
 * from mercury_thread_messages metadata over the last 7 days.
 *
 * STORY-158 — EPIC-013
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

async function requireAdmin(request: NextRequest) {
  const token = await getToken({ req: request })
  if (!token) return null

  const userId = (token.id as string) || token.email || ''
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })

  if (!user || user.role !== 'Partner') return null
  return userId
}

interface LatencyEntry {
  embed_ms: number
  search_ms: number
  generate_ms: number
  selfrag_ms: number
  total_ms: number
  ttfb_ms: number
  selfrag_skipped: boolean
  embed_cached: boolean
  date: string // YYYY-MM-DD
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const adminId = await requireAdmin(request)
  if (!adminId) {
    return NextResponse.json(
      { success: false, error: 'Admin access required (Partner role)' },
      { status: 403 },
    )
  }

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Query assistant messages with metadata from the last 7 days
  const messages = await prisma.mercuryThreadMessage.findMany({
    where: {
      role: 'assistant',
      createdAt: { gte: sevenDaysAgo },
      metadata: { not: null as unknown as undefined },
    },
    select: {
      metadata: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  // Extract latency entries from metadata
  const entries: LatencyEntry[] = []
  for (const msg of messages) {
    const meta = msg.metadata as Record<string, unknown> | null
    if (!meta) continue

    // Check evidence sub-object or top-level fields
    const ev = (meta.evidence as Record<string, unknown>) ?? meta
    const totalMs = (ev.total_ms as number) ?? (meta.latencyMs as number)
    if (totalMs == null) continue

    entries.push({
      embed_ms: (ev.embed_ms as number) ?? 0,
      search_ms: (ev.search_ms as number) ?? 0,
      generate_ms: (ev.generate_ms as number) ?? 0,
      selfrag_ms: (ev.selfrag_ms as number) ?? 0,
      total_ms: totalMs,
      ttfb_ms: (ev.ttfb_ms as number) ?? totalMs,
      selfrag_skipped: (ev.selfrag_skipped as boolean) ?? true,
      embed_cached: (ev.embed_cached as boolean) ?? false,
      date: msg.createdAt.toISOString().slice(0, 10),
    })
  }

  // Group by date
  const byDate: Record<string, LatencyEntry[]> = {}
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = []
    byDate[e.date].push(e)
  }

  // Build daily stats
  const daily = Object.entries(byDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayEntries]) => {
      const ttfbs = dayEntries.map((e) => e.ttfb_ms).sort((a, b) => a - b)
      const count = dayEntries.length
      const avgEmbed = dayEntries.reduce((s, e) => s + e.embed_ms, 0) / count
      const avgSearch = dayEntries.reduce((s, e) => s + e.search_ms, 0) / count
      const avgGenerate = dayEntries.reduce((s, e) => s + e.generate_ms, 0) / count
      const avgSelfrag = dayEntries.reduce((s, e) => s + e.selfrag_ms, 0) / count
      const cacheHits = dayEntries.filter((e) => e.embed_cached).length
      const selfragSkips = dayEntries.filter((e) => e.selfrag_skipped).length

      return {
        date,
        queries: count,
        ttfb_p50: Math.round(percentile(ttfbs, 50)),
        ttfb_p95: Math.round(percentile(ttfbs, 95)),
        ttfb_p99: Math.round(percentile(ttfbs, 99)),
        avg_embed_ms: Math.round(avgEmbed),
        avg_search_ms: Math.round(avgSearch),
        avg_generate_ms: Math.round(avgGenerate),
        avg_selfrag_ms: Math.round(avgSelfrag),
        cache_hit_rate: count > 0 ? Math.round((cacheHits / count) * 100) : 0,
        selfrag_skip_rate: count > 0 ? Math.round((selfragSkips / count) * 100) : 0,
      }
    })

  // Compute 7-day summary
  const totalQueries = entries.length
  const allTtfbs = entries.map((e) => e.ttfb_ms).sort((a, b) => a - b)
  const avgTtfb = totalQueries > 0
    ? Math.round(entries.reduce((s, e) => s + e.ttfb_ms, 0) / totalQueries)
    : 0
  const cacheHitRate = totalQueries > 0
    ? Math.round((entries.filter((e) => e.embed_cached).length / totalQueries) * 100)
    : 0
  const selfragSkipRate = totalQueries > 0
    ? Math.round((entries.filter((e) => e.selfrag_skipped).length / totalQueries) * 100)
    : 0

  // Queries per hour (last 24h)
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)
  const last24h = entries.filter((e) => new Date(e.date) >= oneDayAgo).length
  const queriesPerHour = Math.round((last24h / 24) * 10) / 10

  return NextResponse.json({
    success: true,
    data: {
      summary: {
        totalQueries,
        avgTtfb,
        ttfb_p50: Math.round(percentile(allTtfbs, 50)),
        ttfb_p95: Math.round(percentile(allTtfbs, 95)),
        cacheHitRate,
        selfragSkipRate,
        queriesPerHour,
      },
      daily,
    },
  })
}
