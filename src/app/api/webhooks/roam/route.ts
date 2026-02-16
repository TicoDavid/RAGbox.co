/**
 * ROAM Webhook Route - RAGbox.co
 *
 * POST /api/webhooks/roam — Inbound events from ROAM
 *
 * CRITICAL: Must ACK in <250ms (ROAM timeout is 3s, no retries).
 * Strategy:
 *   1. Read raw body as ArrayBuffer → decode to string (preserves exact bytes)
 *   2. Verify HMAC-SHA256 signature (~5ms)
 *   3. Publish to Pub/Sub roam-events topic (~50ms)
 *   4. Return 200 immediately
 *
 * All processing happens async in the Pub/Sub push endpoint.
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
  const startMs = Date.now()

  // Step 1: Read raw body as ArrayBuffer → UTF-8 string.
  // Using arrayBuffer() + TextDecoder instead of text() to guarantee
  // we get the exact bytes the sender transmitted (no normalization).
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
    console.error('[ROAM Webhook] ROAM_WEBHOOK_SECRET not configured')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const verification = verifyWebhookSignature(
    rawBody,
    {
      'webhook-id': webhookId,
      'webhook-timestamp': webhookTimestamp,
      'webhook-signature': webhookSignature,
    },
    ROAM_WEBHOOK_SECRET
  )

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

  // Step 3: Parse event minimally (just extract type + ID for logging)
  let event: { type?: string; id?: string }
  try {
    event = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Step 4: Publish to Pub/Sub for async processing
  try {
    const topic = getPubSub().topic('roam-events')
    await topic.publishMessage({
      data: Buffer.from(rawBytes),
      attributes: {
        eventType: event.type || 'unknown',
        webhookId,
        receivedAt: new Date().toISOString(),
      },
    })
  } catch (pubsubErr) {
    // If Pub/Sub fails, log but still ACK to ROAM (to prevent retry storm)
    // The event is lost, but better than ROAM blacklisting our webhook
    console.error('[ROAM Webhook] Pub/Sub publish failed:', pubsubErr)
  }

  const elapsed = Date.now() - startMs
  if (elapsed > 200) {
    console.warn(`[ROAM Webhook] Slow ACK: ${elapsed}ms (target <250ms)`)
  }

  // Step 5: Fast ACK
  return NextResponse.json({ ok: true }, { status: 200 })
}
