/**
 * Thread Persistence — RAGbox.co
 *
 * Writes messages from any channel (voice, whatsapp, sms) to the unified
 * mercury_thread_messages table via Prisma. Dashboard messages are already
 * persisted by the frontend mercuryStore.ts; this module covers server-side channels.
 */

import { PrismaClient, type mercury_channel } from '@prisma/client'
import type { InputJsonValue } from '@prisma/client/runtime/library'

const prisma = new PrismaClient()

interface ThreadMessage {
  userId: string
  role: 'user' | 'assistant'
  channel: 'voice' | 'whatsapp' | 'sms' | 'email' | 'roam'
  content: string
  confidence?: number
  channelMessageId?: string
  direction: 'inbound' | 'outbound'
  metadata?: Record<string, unknown>
}

/**
 * Persist a message to the user's unified Mercury thread.
 * Finds or creates the user's most recent thread automatically.
 * Best-effort — errors are logged but never thrown.
 */
export async function persistThreadMessage(msg: ThreadMessage): Promise<void> {
  try {
    // Find or create thread for this user
    let thread = await prisma.mercuryThread.findFirst({
      where: { userId: msg.userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    })

    if (!thread) {
      thread = await prisma.mercuryThread.create({
        data: {
          userId: msg.userId,
          title: 'Mercury Thread',
        },
        select: { id: true },
      })
    }

    // Insert message
    await prisma.mercuryThreadMessage.create({
      data: {
        threadId: thread.id,
        role: msg.role,
        channel: msg.channel as mercury_channel,
        content: msg.content,
        confidence: msg.confidence ?? undefined,
        metadata: msg.metadata ? (msg.metadata as InputJsonValue) : undefined,
      },
    })

    // Touch thread updated_at
    await prisma.mercuryThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    })
  } catch (error) {
    console.error('[ThreadPersistence] Failed to persist message:', error)
  }
}
