/**
 * ROAM Webhook Route - RAGbox.co
 *
 * POST /api/webhooks/roam — Inbound events from ROAM
 *
 * CRITICAL: Must ACK in <250ms (ROAM timeout is 3s, no retries).
 * Strategy:
 *   1. Read raw body as ArrayBuffer → decode to string (preserves exact bytes)
 *   2. Verify HMAC-SHA256 signature (~5ms)
 *   3. Return 200 IMMEDIATELY
 *   4. Pub/Sub publish happens fire-and-forget AFTER response is sent
 */

import { NextRequest, NextResponse } from 'next/server'
import { PubSub } from '@google-cloud/pubsub'
import { verifyWebhookSignature } from '@/lib/roam/roamVerify'

// Force Node.js runtime (not Edge) — required for crypto.createHmac
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROAM_WEBHOOK_SECRET = process.env.ROAM_WEBHOOK_SECRET || ''
const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'ragbox-sovereign-prod'

let pubsubClient: PubSub | null = null
function getPubSub(): PubSub {
  if (!pubsubClient) {
    pubsubClient = new PubSub({ projectId: GCP_PROJECT })
  }
  return pubsubClient
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Step 1: Read raw body as ArrayBuffer → UTF-8 string.
  let rawBody: string
  let rawBytes: ArrayBuffer
  try {
    rawBytes = await request.arrayBuffer()
    rawBody = new TextDecoder('utf-8').decode(rawBytes)
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  // Step 2: Verify webhook signature (NON-NEGOTIABLE)
  const webhookId = request.headers.get('webhook-id') || ''
  const webhookTimestamp = request.headers.get('webhook-timestamp') || ''
  const webhookSignature = request.headers.get('webhook-signature') || ''

  if (!ROAM_WEBHOOK_SECRET) {
    console.warn('[ROAM Webhook] ROAM_WEBHOOK_SECRET not configured — skipping')
    return NextResponse.json({ ok: false, reason: 'not configured' }, { status: 200 })
  }

  let verification: { valid: boolean; error?: string }
  try {
    verification = verifyWebhookSignature(
      rawBody,
      {
        'webhook-id': webhookId,
        'webhook-timestamp': webhookTimestamp,
        'webhook-signature': webhookSignature,
      },
      ROAM_WEBHOOK_SECRET
    )
  } catch (sigErr) {
    console.error('[ROAM Webhook] Signature verification threw:', sigErr)
    // ACK anyway — don't let signature code crash the webhook
    return NextResponse.json({ ok: true }, { status: 200 })
  }

  if (!verification.valid) {
    console.error(
      `[ROAM Webhook] Signature failed: ${verification.error}`,
      `| bodyLen=${rawBody.length}`,
      `| webhookId=${webhookId}`,
      `| ts=${webhookTimestamp}`,
      `| sigHeader=${webhookSignature.slice(0, 20)}...`
    )
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Step 3: Parse event type for Pub/Sub attribute (minimal work)
  let eventType = 'unknown'
  try {
    const parsed = JSON.parse(rawBody)
    eventType = parsed.type || 'unknown'
  } catch { /* ignore — Pub/Sub will get raw bytes regardless */ }

  // Step 4: Fire-and-forget Pub/Sub publish — DO NOT AWAIT.
  // Cloud Run keeps the instance alive after response, so the promise completes.
  getPubSub()
    .topic('roam-events')
    .publishMessage({
      data: Buffer.from(rawBytes),
      attributes: {
        eventType,
        webhookId,
        receivedAt: new Date().toISOString(),
      },
    })
    .catch((err: unknown) => {
      console.error('[ROAM Webhook] Pub/Sub publish failed:', err)
    })

  // Step 5: Fast ACK — return BEFORE Pub/Sub completes
  return NextResponse.json({ ok: true }, { status: 200 })
}
