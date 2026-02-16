/**
 * WhatsApp Event Emitter - RAGbox.co
 *
 * Shared EventEmitter for broadcasting WhatsApp events
 * to WebSocket clients for real-time dashboard updates.
 */

import { EventEmitter } from 'events'

export interface WhatsAppEvent {
  type: 'new_message' | 'status_update' | 'conversation_update'
  userId: string
  conversationId: string
  data: unknown
}

export const whatsAppEventEmitter = new EventEmitter()
whatsAppEventEmitter.setMaxListeners(100)
