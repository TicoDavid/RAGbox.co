/**
 * Mercury Context Module — EPIC-029
 *
 * Builds a context preamble for Mercury's system prompt based on user profile,
 * session history, document scope, and active persona. This gives Mercury
 * cross-session memory and situational awareness.
 */

import type { PersonaId } from '@/stores/mercuryStore.types'

export interface MercuryContext {
  userId: string
  userName?: string
  tier: string
  persona: PersonaId
  documentScope?: { id: string; name: string } | null
  sessionSummaries: Array<{ summary: string; topics: string[]; createdAt: string }>
  recentTopics: string[]
  queryCount: number
}

const PERSONA_LABELS: Record<PersonaId, string> = {
  ceo: 'CEO — strategic, big-picture',
  cfo: 'CFO — financial, risk-aware',
  coo: 'COO — operational, process-focused',
  cpo: 'CPO — product, customer-centric',
  cmo: 'CMO — marketing, brand-focused',
  cto: 'CTO — technical, architecture-focused',
  legal: 'Legal Counsel — liability, compliance',
  compliance: 'Compliance Officer — regulatory, policy',
  auditor: 'Auditor — evidence, control gaps',
  whistleblower: 'Whistleblower — anomalies, red flags',
}

/**
 * Build a context preamble string to prepend to Mercury's system prompt.
 * Includes user identity, active persona lens, document scope, and
 * cross-session memory from previous session summaries.
 */
export function buildContextPreamble(ctx: MercuryContext): string {
  const parts: string[] = []

  // Identity
  const name = ctx.userName || ctx.userId
  parts.push(`You are speaking with ${name} (${ctx.tier} tier).`)

  // Active persona lens
  const personaLabel = PERSONA_LABELS[ctx.persona] || ctx.persona
  parts.push(`Active lens: ${personaLabel}. Tailor analysis accordingly.`)

  // Document scope
  if (ctx.documentScope) {
    parts.push(`Document focus: "${ctx.documentScope.name}" (${ctx.documentScope.id}). Prioritize this document in answers.`)
  }

  // Cross-session memory
  if (ctx.sessionSummaries.length > 0) {
    parts.push('Previous session context:')
    for (const s of ctx.sessionSummaries.slice(0, 3)) {
      const age = getRelativeTime(s.createdAt)
      parts.push(`- ${age}: ${s.summary}`)
    }
  }

  // Current session state
  if (ctx.queryCount > 0) {
    parts.push(`Current session: ${ctx.queryCount} queries so far.`)
    if (ctx.recentTopics.length > 0) {
      parts.push(`Topics discussed: ${ctx.recentTopics.slice(0, 8).join(', ')}.`)
    }
  }

  return parts.join('\n')
}

function getRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}
