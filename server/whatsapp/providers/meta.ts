/**
 * Meta WhatsApp Cloud API Provider - RAGbox.co (Stub)
 *
 * Implements WhatsAppProvider using Meta's Cloud API v21.0.
 * Audio conversion (ffmpeg for OGG/Opus) deferred — not needed for demo.
 */

import crypto from 'crypto'
import type {
  WhatsAppProvider,
  InboundMessage,
  SendResult,
  StatusUpdate,
  MessageStatus,
} from './types'

// ============================================================================
// META CONFIG
// ============================================================================

interface MetaConfig {
  token: string
  phoneNumberId: string
  verifyToken: string
  appSecret: string
}

function loadConfig(): MetaConfig {
  return {
    token: process.env.META_WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.META_WHATSAPP_PHONE_ID || '',
    verifyToken: process.env.META_WHATSAPP_VERIFY_TOKEN || '',
    appSecret: process.env.META_APP_SECRET || '',
  }
}

const GRAPH_API = 'https://graph.facebook.com/v21.0'

// ============================================================================
// META PROVIDER IMPLEMENTATION
// ============================================================================

export class MetaProvider implements WhatsAppProvider {
  readonly name = 'meta' as const
  private config: MetaConfig

  constructor() {
    this.config = loadConfig()
  }

  async sendText(to: string, text: string): Promise<SendResult> {
    try {
      const response = await fetch(
        `${GRAPH_API}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.token}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'text',
            text: { body: text },
          }),
        }
      )

      if (!response.ok) {
        const errorBody = await response.text()
        console.error('[Meta] Send text failed:', response.status, errorBody)
        return {
          externalMessageId: '',
          success: false,
          error: `Meta API error: ${response.status}`,
        }
      }

      const data = await response.json()
      const messageId = data.messages?.[0]?.id || ''
      return { externalMessageId: messageId, success: true }
    } catch (error) {
      console.error('[Meta] Send text error:', error)
      return {
        externalMessageId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async sendAudioMessage(to: string, audioUrl: string): Promise<SendResult> {
    // TODO: Meta requires OGG/Opus format — needs ffmpeg conversion
    // For now, attempt direct URL send (may fail if not OGG/Opus)
    try {
      const response = await fetch(
        `${GRAPH_API}/${this.config.phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.token}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'audio',
            audio: { link: audioUrl },
          }),
        }
      )

      if (!response.ok) {
        const errorBody = await response.text()
        console.error('[Meta] Send audio failed:', response.status, errorBody)
        return {
          externalMessageId: '',
          success: false,
          error: `Meta API error: ${response.status} — audio may need OGG/Opus conversion`,
        }
      }

      const data = await response.json()
      const messageId = data.messages?.[0]?.id || ''
      return { externalMessageId: messageId, success: true }
    } catch (error) {
      console.error('[Meta] Send audio error:', error)
      return {
        externalMessageId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async downloadMedia(mediaId: string): Promise<Buffer> {
    // Step 1: Get media URL
    const metaRes = await fetch(`${GRAPH_API}/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${this.config.token}` },
    })

    if (!metaRes.ok) {
      throw new Error(`Meta media lookup failed: ${metaRes.status}`)
    }

    const { url } = await metaRes.json()

    // Step 2: Download actual media
    const mediaRes = await fetch(url, {
      headers: { 'Authorization': `Bearer ${this.config.token}` },
    })

    if (!mediaRes.ok) {
      throw new Error(`Meta media download failed: ${mediaRes.status}`)
    }

    const arrayBuffer = await mediaRes.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  async markAsRead(messageId: string): Promise<void> {
    try {
      await fetch(`${GRAPH_API}/${this.config.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      })
    } catch (error) {
      console.warn('[Meta] Mark as read failed:', error)
    }
  }

  verifyWebhook(headers: Record<string, string>, rawBody: Buffer): boolean {
    if (!this.config.appSecret) {
      console.warn('[Meta] No META_APP_SECRET — skipping webhook verification')
      return true
    }

    const signature = headers['x-hub-signature-256']
    if (!signature) return false

    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', this.config.appSecret)
      .update(rawBody)
      .digest('hex')

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    } catch {
      return false
    }
  }

  parseInboundMessage(body: unknown): InboundMessage | null {
    // Meta webhook format: { entry: [{ changes: [{ value: { messages: [...] } }] }] }
    const payload = body as Record<string, unknown>
    const entries = payload?.entry as Array<Record<string, unknown>> | undefined
    if (!entries?.length) return null

    const changes = entries[0].changes as Array<Record<string, unknown>> | undefined
    if (!changes?.length) return null

    const value = changes[0].value as Record<string, unknown>
    const messages = value?.messages as Array<Record<string, unknown>> | undefined
    if (!messages?.length) return null

    const msg = messages[0]
    const contacts = value?.contacts as Array<Record<string, unknown>> | undefined
    const contact = contacts?.[0]
    const profile = contact?.profile as Record<string, unknown> | undefined

    const messageType = msg.type as string
    const from = msg.from as string

    const result: InboundMessage = {
      externalMessageId: msg.id as string,
      from: from.startsWith('+') ? from : `+${from}`,
      displayName: profile?.name as string | undefined,
      messageType: normalizeMessageType(messageType),
      timestamp: msg.timestamp
        ? new Date(parseInt(msg.timestamp as string) * 1000)
        : new Date(),
    }

    if (messageType === 'text') {
      const text = msg.text as Record<string, unknown> | undefined
      result.content = text?.body as string | undefined
    } else if (messageType === 'audio') {
      const audio = msg.audio as Record<string, unknown> | undefined
      result.mediaUrl = audio?.id as string | undefined
      result.mediaMimeType = audio?.mime_type as string | undefined
    } else if (messageType === 'image') {
      const image = msg.image as Record<string, unknown> | undefined
      result.mediaUrl = image?.id as string | undefined
      result.content = image?.caption as string | undefined
    }

    return result
  }

  parseStatusUpdate(body: unknown): StatusUpdate | null {
    const payload = body as Record<string, unknown>
    const entries = payload?.entry as Array<Record<string, unknown>> | undefined
    if (!entries?.length) return null

    const changes = entries[0].changes as Array<Record<string, unknown>> | undefined
    if (!changes?.length) return null

    const value = changes[0].value as Record<string, unknown>
    const statuses = value?.statuses as Array<Record<string, unknown>> | undefined
    if (!statuses?.length) return null

    const status = statuses[0]

    return {
      externalMessageId: status.id as string,
      status: normalizeStatus(status.status as string),
      timestamp: status.timestamp
        ? new Date(parseInt(status.timestamp as string) * 1000)
        : new Date(),
    }
  }

  /** Handle Meta's GET verification challenge */
  handleVerifyChallenge(query: Record<string, string>): string | null {
    const mode = query['hub.mode']
    const token = query['hub.verify_token']
    const challenge = query['hub.challenge']

    if (mode === 'subscribe' && token === this.config.verifyToken) {
      return challenge || null
    }
    return null
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function normalizeMessageType(type: string): InboundMessage['messageType'] {
  switch (type) {
    case 'text': return 'text'
    case 'audio': return 'audio'
    case 'image': return 'image'
    case 'document': return 'document'
    default: return 'text'
  }
}

function normalizeStatus(status: string): MessageStatus {
  switch (status) {
    case 'sent': return 'sent'
    case 'delivered': return 'delivered'
    case 'read': return 'read'
    case 'failed': return 'failed'
    default: return 'sent'
  }
}
