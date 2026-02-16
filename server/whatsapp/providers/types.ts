/**
 * WhatsApp Provider Abstraction - RAGbox.co
 *
 * Core interfaces for swappable WhatsApp providers (Vonage, Meta).
 * Selected via WHATSAPP_PROVIDER env var.
 */

// ============================================================================
// ENUMS
// ============================================================================

export type MessageDirection = 'inbound' | 'outbound'
export type MessageType = 'text' | 'audio' | 'image' | 'document' | 'system'
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed'

// ============================================================================
// INBOUND MESSAGE (parsed from webhook payload)
// ============================================================================

export interface InboundMessage {
  /** Provider-specific message ID */
  externalMessageId: string
  /** Sender phone number in E.164 format */
  from: string
  /** Display name of sender (if available) */
  displayName?: string
  /** Message type */
  messageType: MessageType
  /** Text content (for text messages) */
  content?: string
  /** Media URL (for audio/image/document messages) */
  mediaUrl?: string
  /** Media MIME type */
  mediaMimeType?: string
  /** Timestamp from provider */
  timestamp: Date
}

// ============================================================================
// SEND RESULT
// ============================================================================

export interface SendResult {
  /** Provider-specific message ID for the sent message */
  externalMessageId: string
  /** Whether the send was successful */
  success: boolean
  /** Error message if failed */
  error?: string
}

// ============================================================================
// STATUS UPDATE (delivery receipts)
// ============================================================================

export interface StatusUpdate {
  /** Provider-specific message ID */
  externalMessageId: string
  /** New status */
  status: MessageStatus
  /** Timestamp of status change */
  timestamp: Date
}

// ============================================================================
// PROVIDER INTERFACE
// ============================================================================

export interface WhatsAppProvider {
  /** Provider name (e.g., 'vonage', 'meta') */
  readonly name: string

  /** Send a text message */
  sendText(to: string, text: string): Promise<SendResult>

  /** Send an audio message via URL */
  sendAudioMessage(to: string, audioUrl: string): Promise<SendResult>

  /** Download media by provider-specific media ID */
  downloadMedia(mediaId: string): Promise<Buffer>

  /** Mark a message as read */
  markAsRead(messageId: string): Promise<void>

  /** Verify webhook signature */
  verifyWebhook(headers: Record<string, string>, rawBody: Buffer): boolean

  /** Parse inbound webhook payload into InboundMessage */
  parseInboundMessage(body: unknown): InboundMessage | null

  /** Parse status webhook payload into StatusUpdate */
  parseStatusUpdate(body: unknown): StatusUpdate | null
}
