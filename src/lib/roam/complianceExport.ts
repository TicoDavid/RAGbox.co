/**
 * ROAM Compliance Export Client
 *
 * Fetches daily NDJSON compliance exports from ROAM's API.
 * POST /messageevent.export with { date: "YYYY-MM-DD" }
 */
import { logger } from '@/lib/logger'

const ROAM_API_URL = process.env.ROAM_API_URL || 'https://api.ro.am/v1'
const ROAM_API_KEY = process.env.ROAM_API_KEY || ''

// ── Types ──────────────────────────────────────────────────

export interface ComplianceEvent {
  eventType: 'sent' | 'edited' | 'deleted'
  chatId: string
  messageId: string
  timestamp: string // microseconds
  threadTimestamp?: string
  sender: { email?: string; name?: string; type: string }
  contentType: string
  content: { text?: string; markdownText?: string }
}

export interface TextMessage {
  chatId: string
  messageId: string
  senderName: string
  senderEmail?: string
  text: string
  timestamp: Date
}

// ── Functions ──────────────────────────────────────────────

/**
 * Fetch compliance export NDJSON for a given date.
 * @param date    YYYY-MM-DD
 * @param apiKey  Per-tenant key override (falls back to env var)
 */
export async function fetchComplianceExport(date: string, apiKey?: string): Promise<string> {
  const key = apiKey || ROAM_API_KEY
  if (!key) {
    throw new Error('ROAM API key not configured')
  }

  const res = await fetch(`${ROAM_API_URL}/messageevent.export`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept': 'application/x-ndjson, text/plain, */*',
    },
    body: JSON.stringify({ date }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`ROAM compliance export failed: ${res.status} ${body.slice(0, 200)}`)
  }

  return res.text()
}

/**
 * Parse NDJSON string into ComplianceEvent array.
 */
export function parseComplianceNdjson(ndjson: string): ComplianceEvent[] {
  const events: ComplianceEvent[] = []
  const lines = ndjson.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      events.push(JSON.parse(trimmed) as ComplianceEvent)
    } catch {
      logger.warn('[Compliance] Skipping unparseable line:', trimmed.slice(0, 80))
    }
  }

  return events
}

/**
 * Filter to sent text messages, normalize into TextMessage[].
 */
export function extractTextContent(events: ComplianceEvent[]): TextMessage[] {
  return events
    .filter((e) => e.eventType === 'sent' && (e.content?.text || e.content?.markdownText))
    .map((e) => ({
      chatId: e.chatId,
      messageId: e.messageId,
      senderName: e.sender?.name || e.sender?.email || 'Unknown',
      senderEmail: e.sender?.email,
      text: e.content.text || e.content.markdownText || '',
      timestamp: parseRoamTimestamp(e.timestamp),
    }))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

/**
 * Group messages by chatId into conversation arrays.
 */
export function groupByChat(messages: TextMessage[]): Map<string, TextMessage[]> {
  const groups = new Map<string, TextMessage[]>()
  for (const msg of messages) {
    const existing = groups.get(msg.chatId)
    if (existing) {
      existing.push(msg)
    } else {
      groups.set(msg.chatId, [msg])
    }
  }
  return groups
}

/**
 * Parse ROAM timestamp (microseconds string) to Date.
 */
function parseRoamTimestamp(ts: string): Date {
  const micro = parseInt(ts, 10)
  if (isNaN(micro)) return new Date(ts) // fallback: try ISO parse
  return new Date(micro / 1000) // microseconds → milliseconds
}
