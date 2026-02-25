/**
 * ROAM HQ API Client
 *
 * Thin wrapper around ROAM's REST API v1.
 * All methods throw on non-2xx responses with structured error info.
 *
 * Per-tenant support: all public functions accept an optional `apiKey`
 * parameter. When provided, it overrides the env-var default.
 * When omitted, falls back to ROAM_API_KEY env var (backward compat).
 *
 * STORY-102 — EPIC-010
 */
import { logger } from '@/lib/logger'

const ROAM_API_URL = process.env.ROAM_API_URL || 'https://api.ro.am/v1'
const ROAM_API_KEY = process.env.ROAM_API_KEY || ''

// ── Types ──────────────────────────────────────────────────────────

export interface RoamGroup {
  id: string
  name: string
  description?: string
  memberCount?: number
}

export interface RoamMessage {
  id: string
  groupId: string
  senderId: string
  text: string
  createdAt: string
}

export interface RoamSendMessagePayload {
  groupId: string
  text: string
  /** Optional thread ID to reply in-thread */
  threadId?: string
}

export interface RoamTranscriptInfo {
  id: string
  groupId: string
  title?: string
  participants?: string[]
  content?: string
  duration?: number
  createdAt: string
}

export interface RoamWebhookEvent {
  id: string
  type: string
  timestamp: string
  data: Record<string, unknown>
}

export class RoamApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message)
    this.name = 'RoamApiError'
  }
}

// ── Retry config (mirrors backend/internal/gcpclient/retry.go) ────

const RETRY_DELAYS = [500, 1000, 2000] // ms
const RETRYABLE_CODES = new Set([429, 503])
const NON_RETRYABLE_CODES = new Set([400, 401, 403, 404])

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Internal fetch helper ──────────────────────────────────────────

async function roamFetch<T>(
  path: string,
  options: RequestInit = {},
  apiKey?: string
): Promise<T> {
  const key = apiKey || ROAM_API_KEY
  if (!key) {
    throw new RoamApiError('ROAM API key not configured', 500, 'CONFIG_ERROR')
  }

  const url = `${ROAM_API_URL}${path}`
  const reqInit: RequestInit = {
    ...options,
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  }

  let lastError: RoamApiError | undefined

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS[attempt - 1]
      logger.warn(`[ROAM] Retry ${attempt}/${RETRY_DELAYS.length} for ${path} after ${delay}ms`)
      await sleep(delay)
    }

    const res = await fetch(url, reqInit)

    if (res.ok) {
      if (res.status === 204) return undefined as T
      return res.json() as Promise<T>
    }

    const body = await res.text().catch(() => '')
    let code: string | undefined
    try {
      const parsed = JSON.parse(body)
      code = parsed.error?.code || parsed.code
    } catch { /* ignore */ }

    lastError = new RoamApiError(
      `ROAM API ${res.status}: ${body.slice(0, 200)}`,
      res.status,
      code
    )

    // Non-retryable status codes — throw immediately
    if (NON_RETRYABLE_CODES.has(res.status)) {
      throw lastError
    }

    // Only retry on retryable codes
    if (!RETRYABLE_CODES.has(res.status)) {
      throw lastError
    }
  }

  // All retries exhausted
  throw lastError!
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Send a message to a ROAM group (or thread within a group).
 * @param apiKey  Per-tenant key override (falls back to env var)
 */
export async function sendMessage(
  payload: RoamSendMessagePayload,
  apiKey?: string
): Promise<RoamMessage> {
  const body: Record<string, string> = {
    // ROAM uses addressId as the chat/group identifier
    addressId: payload.groupId,
    text: payload.text,
  }
  if (payload.threadId) {
    body.thread_id = payload.threadId
  }
  return roamFetch<RoamMessage>('/messages', {
    method: 'POST',
    body: JSON.stringify(body),
  }, apiKey)
}

/**
 * Send a typing indicator to a ROAM group.
 * Fire-and-forget — errors are logged but not thrown.
 * @param apiKey  Per-tenant key override (falls back to env var)
 */
export async function sendTypingIndicator(
  groupId: string,
  apiKey?: string
): Promise<void> {
  try {
    await roamFetch<void>('/chat.typing', {
      method: 'POST',
      body: JSON.stringify({ addressId: groupId }),
    }, apiKey)
  } catch (error) {
    logger.warn('[ROAM] Typing indicator failed (non-fatal):', error)
  }
}

/**
 * List groups the ROAM app (M.E.R.C.U.R.Y) has access to.
 * @param apiKey  Per-tenant key override (falls back to env var)
 */
export async function listGroups(apiKey?: string): Promise<RoamGroup[]> {
  interface RoamGroupRaw {
    id?: string
    addressId?: string
    name: string
    description?: string
    memberCount?: number
  }
  const res = await roamFetch<{ groups: RoamGroupRaw[] }>('/groups', {}, apiKey)
  // ROAM returns addressId as the primary identifier; normalize to id
  return (res.groups ?? []).map(g => ({
    id: g.addressId || g.id || '',
    name: g.name,
    description: g.description,
    memberCount: g.memberCount,
  }))
}

/**
 * List groups using a specific API key (for pre-connect validation).
 * Alias for listGroups() with explicit key — does NOT fall back to env var.
 */
export async function listGroupsWithKey(apiKey: string): Promise<RoamGroup[]> {
  return listGroups(apiKey)
}

/**
 * Export messages from a group (paginated).
 * @param groupId  ROAM group ID
 * @param limit    Max messages to return (default 50)
 * @param before   Cursor — return messages before this message ID
 * @param apiKey   Per-tenant key override (falls back to env var)
 */
export async function exportMessages(
  groupId: string,
  limit = 50,
  before?: string,
  apiKey?: string
): Promise<RoamMessage[]> {
  const params = new URLSearchParams({
    group_id: groupId,
    limit: String(Math.min(limit, 100)),
  })
  if (before) params.set('before', before)

  const res = await roamFetch<{ messages: RoamMessage[] }>(
    `/messages?${params.toString()}`,
    {},
    apiKey
  )
  return res.messages ?? []
}

/**
 * Get transcript info by ID.
 * @param transcriptId  ROAM transcript ID
 * @param apiKey        Per-tenant key override (falls back to env var)
 */
export async function getTranscriptInfo(
  transcriptId: string,
  apiKey?: string
): Promise<RoamTranscriptInfo> {
  const params = new URLSearchParams({ id: transcriptId })
  return roamFetch<RoamTranscriptInfo>(
    `/transcript.info?${params.toString()}`,
    {},
    apiKey
  )
}
