/**
 * WhatsApp Message Processor - RAGbox.co
 *
 * Pipeline:
 * 1. Find/create WhatsAppContact by phone number
 * 2. Find/create WhatsAppConversation
 * 3. Persist inbound WhatsAppMessage
 * 4. Update conversation metadata
 * 5. Mark as read on provider side
 * 6. Emit event for dashboard real-time
 * 7. If autoReply: call Go backend RAG, send response, persist outbound message
 */

import { PrismaClient } from '@prisma/client'
import { getWhatsAppProvider } from './providers/factory'
import { whatsAppEventEmitter } from './events'
import type { InboundMessage, StatusUpdate } from './providers/types'

const prisma = new PrismaClient()

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''
const DEFAULT_USER_ID = process.env.WHATSAPP_DEFAULT_USER_ID || ''

// ============================================================================
// PROCESS INBOUND MESSAGE
// ============================================================================

export async function processInboundMessage(message: InboundMessage): Promise<void> {
  const provider = getWhatsAppProvider()

  // For demo: route all messages to a default user
  const userId = DEFAULT_USER_ID
  if (!userId) {
    console.error('[WhatsApp] No WHATSAPP_DEFAULT_USER_ID configured — cannot route message')
    return
  }

  try {
    // 1. Find or create contact
    const contact = await prisma.whatsAppContact.upsert({
      where: {
        userId_phoneNumber: {
          userId,
          phoneNumber: message.from,
        },
      },
      update: {
        displayName: message.displayName || undefined,
      },
      create: {
        userId,
        phoneNumber: message.from,
        displayName: message.displayName,
      },
    })

    if (contact.isBlocked) {
      console.log(`[WhatsApp] Blocked contact ${message.from} — ignoring`)
      return
    }

    // 2. Find or create conversation
    const conversation = await prisma.whatsAppConversation.upsert({
      where: {
        userId_contactId: {
          userId,
          contactId: contact.id,
        },
      },
      update: {},
      create: {
        userId,
        contactId: contact.id,
        autoReply: true,
      },
    })

    if (conversation.status === 'blocked') {
      console.log(`[WhatsApp] Blocked conversation — ignoring`)
      return
    }

    // 3. Persist inbound message
    const dbMessage = await prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        externalMessageId: message.externalMessageId,
        direction: 'inbound',
        messageType: message.messageType,
        content: message.content || null,
        mediaUrl: message.mediaUrl || null,
        status: 'delivered',
      },
    })

    // 4. Update conversation metadata
    const preview = message.content
      ? message.content.slice(0, 100)
      : `[${message.messageType}]`

    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageText: preview,
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
      },
    })

    // 5. Mark as read on provider side
    try {
      await provider.markAsRead(message.externalMessageId)
    } catch (error) {
      console.warn('[WhatsApp] Failed to mark as read:', error)
    }

    // 6. Emit event for dashboard real-time
    whatsAppEventEmitter.emit('message', {
      type: 'new_message',
      userId,
      conversationId: conversation.id,
      data: {
        id: dbMessage.id,
        direction: 'inbound',
        messageType: message.messageType,
        content: message.content,
        mediaUrl: message.mediaUrl,
        createdAt: dbMessage.createdAt,
        contactName: contact.displayName || message.from,
      },
    })

    console.log(`[WhatsApp] Processed inbound from ${message.from}: ${preview}`)

    // 7. Auto-reply via RAG if enabled and message is text
    if (conversation.autoReply && message.messageType === 'text' && message.content) {
      await handleAutoReply(conversation.id, userId, message.from, message.content)
    }
  } catch (error) {
    console.error('[WhatsApp] Error processing inbound message:', error)
  }
}

// ============================================================================
// AUTO-REPLY VIA RAG
// ============================================================================

async function handleAutoReply(
  conversationId: string,
  userId: string,
  toPhone: string,
  queryText: string,
): Promise<void> {
  const provider = getWhatsAppProvider()

  try {
    // Call Go backend RAG pipeline (same as Mercury chat)
    const ragResponse = await fetch(`${GO_BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_AUTH_SECRET,
        'X-User-ID': userId,
      },
      body: JSON.stringify({
        query: queryText,
        stream: false,
        privilegeMode: false,
        maxTier: 3,
        history: [],
      }),
    })

    let replyText = ''
    let confidence: number | undefined
    let queryId: string | undefined

    if (ragResponse.ok) {
      const data = await ragResponse.json()
      replyText = data.data?.answer || data.answer || ''
      confidence = data.data?.confidence || data.confidence
      queryId = data.data?.queryId || data.queryId
    }

    if (!replyText) {
      replyText = "I couldn't find a relevant answer in the knowledge base. Please try rephrasing your question."
    }

    // Truncate for WhatsApp (max 4096 chars)
    if (replyText.length > 4000) {
      replyText = replyText.slice(0, 3997) + '...'
    }

    // Send via provider
    const sendResult = await provider.sendText(toPhone, replyText)

    // Persist outbound message
    const dbMessage = await prisma.whatsAppMessage.create({
      data: {
        conversationId,
        externalMessageId: sendResult.externalMessageId || null,
        direction: 'outbound',
        messageType: 'text',
        content: replyText,
        status: sendResult.success ? 'sent' : 'failed',
        confidence,
        queryId,
      },
    })

    // Update conversation
    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageText: replyText.slice(0, 100),
        lastMessageAt: new Date(),
      },
    })

    // Emit event for dashboard
    whatsAppEventEmitter.emit('message', {
      type: 'new_message',
      userId,
      conversationId,
      data: {
        id: dbMessage.id,
        direction: 'outbound',
        messageType: 'text',
        content: replyText,
        confidence,
        createdAt: dbMessage.createdAt,
        autoReply: true,
      },
    })

    console.log(`[WhatsApp] Auto-reply sent to ${toPhone} (confidence: ${confidence ?? 'N/A'})`)
  } catch (error) {
    console.error('[WhatsApp] Auto-reply failed:', error)
  }
}

// ============================================================================
// PROCESS STATUS UPDATE
// ============================================================================

export async function processStatusUpdate(update: StatusUpdate): Promise<void> {
  try {
    const message = await prisma.whatsAppMessage.findFirst({
      where: { externalMessageId: update.externalMessageId },
      include: { conversation: true },
    })

    if (!message) return

    await prisma.whatsAppMessage.update({
      where: { id: message.id },
      data: { status: update.status },
    })

    whatsAppEventEmitter.emit('message', {
      type: 'status_update',
      userId: message.conversation.userId,
      conversationId: message.conversationId,
      data: {
        messageId: message.id,
        status: update.status,
      },
    })
  } catch (error) {
    console.error('[WhatsApp] Error processing status update:', error)
  }
}

// ============================================================================
// SEND MANUAL MESSAGE (from dashboard)
// ============================================================================

export async function sendManualMessage(
  conversationId: string,
  text: string,
): Promise<{ success: boolean; error?: string }> {
  const provider = getWhatsAppProvider()

  try {
    const conversation = await prisma.whatsAppConversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    })

    if (!conversation) {
      return { success: false, error: 'Conversation not found' }
    }

    const sendResult = await provider.sendText(conversation.contact.phoneNumber, text)

    if (!sendResult.success) {
      return { success: false, error: sendResult.error }
    }

    // Persist
    await prisma.whatsAppMessage.create({
      data: {
        conversationId,
        externalMessageId: sendResult.externalMessageId || null,
        direction: 'outbound',
        messageType: 'text',
        content: text,
        status: 'sent',
      },
    })

    await prisma.whatsAppConversation.update({
      where: { id: conversationId },
      data: {
        lastMessageText: text.slice(0, 100),
        lastMessageAt: new Date(),
      },
    })

    whatsAppEventEmitter.emit('message', {
      type: 'new_message',
      userId: conversation.userId,
      conversationId,
      data: {
        direction: 'outbound',
        messageType: 'text',
        content: text,
        createdAt: new Date(),
      },
    })

    return { success: true }
  } catch (error) {
    console.error('[WhatsApp] Send manual message failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
