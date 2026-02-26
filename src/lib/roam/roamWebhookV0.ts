/**
 * ROAM Webhook Auto-Subscribe (Events API v0)
 *
 * Subscribes to all 7 ROAM event types via the v0 Events API.
 * Called by the connector install flow (S01).
 *
 * Rate limit: 10 burst, 1 req/sec sustained. Sleep 1100ms between calls.
 * Safe to re-run: ROAM updates existing subscription for same event+URL (no duplicate).
 *
 * EPIC-018 S03
 */

import { logger } from '@/lib/logger'

const ROAM_V0_API_URL = process.env.ROAM_V0_API_URL || 'https://api.ro.am/v0'
const WEBHOOK_URL =
  process.env.ROAM_WEBHOOK_URL ||
  'https://ragbox-app-100739220279.us-east4.run.app/api/webhooks/roam'

/**
 * All 7 ROAM event types to subscribe to on install.
 */
const EVENTS = [
  'chat.message.dm',
  'chat.message.channel',
  'chat.message.mention',
  'chat.message.reaction',
  'transcript.saved',
  'recording.saved',
  'lobby.booked',
] as const

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Types ──────────────────────────────────────────────────────────

export interface SubscriptionResult {
  subscriptionIds: string[]
  errors: Array<{ event: string; error: string }>
}

// ── Auto-Subscribe ─────────────────────────────────────────────────

/**
 * Subscribe to all 7 ROAM event types.
 * Returns subscription IDs for storage (needed for unsubscribe on disconnect).
 *
 * @param apiKey Decrypted tenant ROAM API key
 */
export async function autoSubscribeWebhooks(apiKey: string): Promise<SubscriptionResult> {
  const subscriptionIds: string[] = []
  const errors: Array<{ event: string; error: string }> = []

  for (const event of EVENTS) {
    try {
      const res = await fetch(`${ROAM_V0_API_URL}/webhook.subscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: WEBHOOK_URL, event }),
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        errors.push({ event, error: `HTTP ${res.status}: ${body.slice(0, 200)}` })
        logger.error(`[ROAM Webhooks] Subscribe failed for ${event}: ${res.status}`)
      } else {
        const data = await res.json()
        if (data.id) {
          subscriptionIds.push(data.id)
        }
        logger.info(`[ROAM Webhooks] Subscribed to ${event} → id=${data.id}`)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error'
      errors.push({ event, error: msg })
      logger.error(`[ROAM Webhooks] Subscribe error for ${event}:`, error)
    }

    // Rate limit: 1 req/sec sustained
    await sleep(1100)
  }

  return { subscriptionIds, errors }
}

// ── Unsubscribe All ────────────────────────────────────────────────

/**
 * Unsubscribe from all stored webhook subscription IDs.
 *
 * @param apiKey          Decrypted tenant ROAM API key
 * @param subscriptionIds Array of subscription IDs from previous autoSubscribeWebhooks call
 */
export async function unsubscribeAllWebhooks(
  apiKey: string,
  subscriptionIds: string[]
): Promise<void> {
  for (const id of subscriptionIds) {
    try {
      const res = await fetch(`${ROAM_V0_API_URL}/webhook.unsubscribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      })

      if (!res.ok) {
        logger.warn(`[ROAM Webhooks] Unsubscribe failed for ${id}: ${res.status}`)
      } else {
        logger.info(`[ROAM Webhooks] Unsubscribed ${id}`)
      }
    } catch (error) {
      logger.error(`[ROAM Webhooks] Unsubscribe error for ${id}:`, error)
    }

    // Rate limit: 1 req/sec sustained
    await sleep(1100)
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Parse stored subscription IDs from the database.
 * Stored as JSON array string in webhookSubscriptionId.
 */
export function parseSubscriptionIds(stored: string | null): string[] {
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : [stored]
  } catch {
    // Legacy single-ID string
    return stored ? [stored] : []
  }
}
