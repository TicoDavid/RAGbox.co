/**
 * ROAM Webhook Subscription Lifecycle
 *
 * Manages webhook subscriptions: create, check, and unsubscribe.
 * Used by the health-check cron to auto-reconnect dropped subscriptions.
 *
 * STORY-104 — EPIC-010
 */

import { RoamApiError } from './roamClient'

const ROAM_API_URL = process.env.ROAM_API_URL || 'https://api.ro.am/v1'

const DEFAULT_EVENT_TYPES = [
  'chat.message.dm',
  'chat.message.group',
  'message.created',
  'transcript.saved',
  'reaction.added',
]

// ── Types ──────────────────────────────────────────────────────────

export interface WebhookSubscription {
  id: string
  url?: string
  eventTypes?: string[]
  status?: string
  createdAt?: string
}

// ── Internal helper ────────────────────────────────────────────────

async function webhookFetch<T>(
  path: string,
  options: RequestInit,
  apiKey: string,
): Promise<T> {
  const res = await fetch(`${ROAM_API_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new RoamApiError(
      `ROAM Webhook API ${res.status}: ${body.slice(0, 200)}`,
      res.status,
    )
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Create or ensure a webhook subscription exists.
 * @param apiKey     Decrypted tenant ROAM API key
 * @param eventTypes Event types to subscribe to (defaults to all supported)
 * @returns The subscription object with its ID
 */
export async function ensureWebhookSubscription(
  apiKey: string,
  eventTypes: string[] = DEFAULT_EVENT_TYPES,
): Promise<WebhookSubscription> {
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.ragbox.co'}/api/roam/webhook`

  return webhookFetch<WebhookSubscription>('/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      url: callbackUrl,
      event_types: eventTypes,
    }),
  }, apiKey)
}

/**
 * Check whether a webhook subscription is still active.
 * @param apiKey         Decrypted tenant ROAM API key
 * @param subscriptionId The subscription ID to check
 * @returns The subscription object, or null if not found (404)
 */
export async function checkWebhookSubscription(
  apiKey: string,
  subscriptionId: string,
): Promise<WebhookSubscription | null> {
  try {
    return await webhookFetch<WebhookSubscription>(
      `/webhooks/${subscriptionId}`,
      { method: 'GET' },
      apiKey,
    )
  } catch (error) {
    if (error instanceof RoamApiError && error.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Delete a webhook subscription.
 * @param apiKey         Decrypted tenant ROAM API key
 * @param subscriptionId The subscription ID to delete
 */
export async function unsubscribeWebhook(
  apiKey: string,
  subscriptionId: string,
): Promise<void> {
  await webhookFetch<void>(
    `/webhooks/${subscriptionId}`,
    { method: 'DELETE' },
    apiKey,
  )
}
