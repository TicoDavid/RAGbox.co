/**
 * ROAM HQ API Client
 *
 * Thin wrapper around ROAM's REST API v1.
 * All methods throw on non-2xx responses with structured error info.
 */

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

// ── Internal fetch helper ──────────────────────────────────────────

async function roamFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!ROAM_API_KEY) {
    throw new RoamApiError('ROAM_API_KEY not configured', 500, 'CONFIG_ERROR')
  }

  const url = `${ROAM_API_URL}${path}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${ROAM_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let code: string | undefined
    try {
      const parsed = JSON.parse(body)
      code = parsed.error?.code || parsed.code
    } catch { /* ignore */ }
    throw new RoamApiError(
      `ROAM API ${res.status}: ${body.slice(0, 200)}`,
      res.status,
      code
    )
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Send a message to a ROAM group (or thread within a group).
 */
export async function sendMessage(
  payload: RoamSendMessagePayload
): Promise<RoamMessage> {
  const body: Record<string, string> = {
    group_id: payload.groupId,
    text: payload.text,
  }
  if (payload.threadId) {
    body.thread_id = payload.threadId
  }
  return roamFetch<RoamMessage>('/messages', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/**
 * List groups the ROAM app (M.E.R.C.U.R.Y) has access to.
 */
export async function listGroups(): Promise<RoamGroup[]> {
  const res = await roamFetch<{ groups: RoamGroup[] }>('/groups')
  return res.groups ?? []
}

/**
 * Export messages from a group (paginated).
 * @param groupId  ROAM group ID
 * @param limit    Max messages to return (default 50)
 * @param before   Cursor — return messages before this message ID
 */
export async function exportMessages(
  groupId: string,
  limit = 50,
  before?: string
): Promise<RoamMessage[]> {
  const params = new URLSearchParams({
    group_id: groupId,
    limit: String(Math.min(limit, 100)),
  })
  if (before) params.set('before', before)

  const res = await roamFetch<{ messages: RoamMessage[] }>(
    `/messages?${params.toString()}`
  )
  return res.messages ?? []
}
