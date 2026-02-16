/**
 * Vonage WhatsApp Provider - RAGbox.co
 *
 * Implements WhatsAppProvider using the Vonage Messages API.
 * Vonage accepts MP3 directly — no ffmpeg conversion needed.
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
// VONAGE CONFIG
// ============================================================================

interface VonageConfig {
  apiKey: string
  apiSecret: string
  applicationId: string
  privateKeyPath: string
  whatsappNumber: string
  signatureSecret: string
}

function loadConfig(): VonageConfig {
  const apiKey = process.env.VONAGE_API_KEY
  const apiSecret = process.env.VONAGE_API_SECRET
  const applicationId = process.env.VONAGE_APPLICATION_ID
  const privateKeyPath = process.env.VONAGE_PRIVATE_KEY_PATH
  const whatsappNumber = process.env.VONAGE_WHATSAPP_NUMBER
  const signatureSecret = process.env.VONAGE_SIGNATURE_SECRET

  if (!apiKey || !apiSecret || !applicationId || !whatsappNumber) {
    throw new Error(
      'Missing Vonage config: VONAGE_API_KEY, VONAGE_API_SECRET, VONAGE_APPLICATION_ID, VONAGE_WHATSAPP_NUMBER are required'
    )
  }

  return {
    apiKey,
    apiSecret,
    applicationId,
    privateKeyPath: privateKeyPath || '',
    whatsappNumber,
    signatureSecret: signatureSecret || '',
  }
}

// ============================================================================
// JWT GENERATION (for Vonage Messages API v1)
// ============================================================================

function generateVonageJWT(config: VonageConfig): string {
  // For demo/sandbox, use Basic auth with API key + secret
  // Production would use JWT with private key
  return Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')
}

// ============================================================================
// VONAGE PROVIDER IMPLEMENTATION
// ============================================================================

export class VonageProvider implements WhatsAppProvider {
  readonly name = 'vonage' as const
  private config: VonageConfig

  constructor() {
    this.config = loadConfig()
  }

  async sendText(to: string, text: string): Promise<SendResult> {
    try {
      const response = await fetch('https://messages-sandbox.nexmo.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${generateVonageJWT(this.config)}`,
        },
        body: JSON.stringify({
          message_type: 'text',
          text,
          to,
          from: this.config.whatsappNumber,
          channel: 'whatsapp',
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error('[Vonage] Send text failed:', response.status, errorBody)
        return {
          externalMessageId: '',
          success: false,
          error: `Vonage API error: ${response.status}`,
        }
      }

      const data = await response.json()
      return {
        externalMessageId: data.message_uuid || '',
        success: true,
      }
    } catch (error) {
      console.error('[Vonage] Send text error:', error)
      return {
        externalMessageId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async sendAudioMessage(to: string, audioUrl: string): Promise<SendResult> {
    try {
      // Vonage accepts MP3 URLs directly — no conversion needed
      const response = await fetch('https://messages-sandbox.nexmo.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${generateVonageJWT(this.config)}`,
        },
        body: JSON.stringify({
          message_type: 'audio',
          audio: { url: audioUrl },
          to,
          from: this.config.whatsappNumber,
          channel: 'whatsapp',
        }),
      })

      if (!response.ok) {
        const errorBody = await response.text()
        console.error('[Vonage] Send audio failed:', response.status, errorBody)
        return {
          externalMessageId: '',
          success: false,
          error: `Vonage API error: ${response.status}`,
        }
      }

      const data = await response.json()
      return {
        externalMessageId: data.message_uuid || '',
        success: true,
      }
    } catch (error) {
      console.error('[Vonage] Send audio error:', error)
      return {
        externalMessageId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async downloadMedia(mediaId: string): Promise<Buffer> {
    const response = await fetch(`https://api.nexmo.com/v3/media/${mediaId}`, {
      headers: {
        'Authorization': `Basic ${generateVonageJWT(this.config)}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Vonage media download failed: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  async markAsRead(_messageId: string): Promise<void> {
    // Vonage sandbox doesn't support read receipts — no-op
  }

  verifyWebhook(headers: Record<string, string>, rawBody: Buffer): boolean {
    if (!this.config.signatureSecret) {
      // No signature secret configured — skip verification (dev mode)
      console.warn('[Vonage] No VONAGE_SIGNATURE_SECRET — skipping webhook verification')
      return true
    }

    const signature = headers['authorization']
    if (!signature) return false

    const expectedSignature = crypto
      .createHmac('sha256', this.config.signatureSecret)
      .update(rawBody)
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )
  }

  parseInboundMessage(body: unknown): InboundMessage | null {
    const payload = body as Record<string, unknown>
    if (!payload) return null

    // Vonage Messages API inbound webhook format
    const messageType = payload.message_type as string
    if (!messageType) return null

    const from = (payload.from as Record<string, unknown>)?.number as string
      || payload.from as string
    if (!from) return null

    const timestamp = payload.timestamp
      ? new Date(payload.timestamp as string)
      : new Date()

    const profile = payload.profile as Record<string, unknown> | undefined

    const result: InboundMessage = {
      externalMessageId: (payload.message_uuid as string) || '',
      from: from.startsWith('+') ? from : `+${from}`,
      displayName: profile?.name as string | undefined,
      messageType: normalizeMessageType(messageType),
      timestamp,
    }

    // Extract content based on type
    if (messageType === 'text') {
      result.content = (payload.text as string) || ''
    } else if (messageType === 'audio') {
      const audio = payload.audio as Record<string, unknown> | undefined
      result.mediaUrl = audio?.url as string | undefined
      result.mediaMimeType = audio?.caption as string | undefined
    } else if (messageType === 'image') {
      const image = payload.image as Record<string, unknown> | undefined
      result.mediaUrl = image?.url as string | undefined
      result.content = image?.caption as string | undefined
    }

    return result
  }

  parseStatusUpdate(body: unknown): StatusUpdate | null {
    const payload = body as Record<string, unknown>
    if (!payload || !payload.message_uuid) return null

    const status = payload.status as string
    if (!status) return null

    return {
      externalMessageId: payload.message_uuid as string,
      status: normalizeStatus(status),
      timestamp: payload.timestamp
        ? new Date(payload.timestamp as string)
        : new Date(),
    }
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
    case 'file':
    case 'document': return 'document'
    default: return 'text'
  }
}

function normalizeStatus(status: string): MessageStatus {
  switch (status) {
    case 'submitted':
    case 'sent': return 'sent'
    case 'delivered': return 'delivered'
    case 'read': return 'read'
    case 'rejected':
    case 'failed':
    case 'undeliverable': return 'failed'
    default: return 'sent'
  }
}
