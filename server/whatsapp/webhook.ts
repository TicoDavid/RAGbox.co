/**
 * WhatsApp Webhook Handler - RAGbox.co
 *
 * HTTP handlers for WhatsApp webhook endpoints:
 * - GET  /whatsapp/webhook        — Meta verification challenge
 * - POST /whatsapp/webhook        — Inbound messages
 * - POST /whatsapp/webhook/status — Delivery receipts
 */

import type { IncomingMessage, ServerResponse } from 'http'
import { parse } from 'url'
import { getWhatsAppProvider } from './providers/factory'
import { MetaProvider } from './providers/meta'
import { processInboundMessage, processStatusUpdate } from './processor'

// ============================================================================
// RAW BODY READER
// ============================================================================

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

// ============================================================================
// WEBHOOK HANDLER
// ============================================================================

export async function handleWhatsAppWebhook(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const { pathname, query } = parse(req.url || '', true)
  const method = req.method || 'GET'

  // -------------------------------------------------------------------
  // GET /whatsapp/webhook — Meta verification challenge
  // -------------------------------------------------------------------
  if (method === 'GET' && pathname === '/whatsapp/webhook') {
    const provider = getWhatsAppProvider()

    if (provider.name === 'meta') {
      const metaProvider = provider as MetaProvider
      const challenge = metaProvider.handleVerifyChallenge(
        query as Record<string, string>
      )
      if (challenge) {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end(challenge)
        return
      }
    }

    // Vonage doesn't use GET verification
    res.writeHead(405, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Method not allowed' }))
    return
  }

  // -------------------------------------------------------------------
  // POST /whatsapp/webhook — Inbound messages
  // -------------------------------------------------------------------
  if (method === 'POST' && pathname === '/whatsapp/webhook') {
    const provider = getWhatsAppProvider()
    const rawBody = await readBody(req)

    // Verify webhook signature
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers[key.toLowerCase()] = value
      }
    }

    if (!provider.verifyWebhook(headers, rawBody)) {
      console.warn('[WhatsApp] Webhook signature verification failed')
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid signature' }))
      return
    }

    // Respond 200 immediately (WhatsApp requires fast response)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))

    // Parse and process async
    try {
      const body = JSON.parse(rawBody.toString())

      // Try parsing as inbound message
      const inboundMessage = provider.parseInboundMessage(body)
      if (inboundMessage) {
        processInboundMessage(inboundMessage).catch((error) => {
          console.error('[WhatsApp] Async processing failed:', error)
        })
        return
      }

      // Try parsing as status update
      const statusUpdate = provider.parseStatusUpdate(body)
      if (statusUpdate) {
        processStatusUpdate(statusUpdate).catch((error) => {
          console.error('[WhatsApp] Status update processing failed:', error)
        })
        return
      }

      console.log('[WhatsApp] Unrecognized webhook payload — ignored')
    } catch (error) {
      console.error('[WhatsApp] Failed to parse webhook body:', error)
    }
    return
  }

  // -------------------------------------------------------------------
  // POST /whatsapp/webhook/status — Explicit status endpoint
  // -------------------------------------------------------------------
  if (method === 'POST' && pathname === '/whatsapp/webhook/status') {
    const provider = getWhatsAppProvider()
    const rawBody = await readBody(req)

    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') {
        headers[key.toLowerCase()] = value
      }
    }

    if (!provider.verifyWebhook(headers, rawBody)) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid signature' }))
      return
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))

    try {
      const body = JSON.parse(rawBody.toString())
      const statusUpdate = provider.parseStatusUpdate(body)
      if (statusUpdate) {
        processStatusUpdate(statusUpdate).catch((error) => {
          console.error('[WhatsApp] Status processing failed:', error)
        })
      }
    } catch (error) {
      console.error('[WhatsApp] Failed to parse status webhook:', error)
    }
    return
  }

  // Unknown sub-route
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not Found' }))
}
