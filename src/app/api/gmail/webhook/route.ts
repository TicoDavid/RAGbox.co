/**
 * Gmail Push Notification Webhook
 * POST /api/gmail/webhook — Receives Pub/Sub push messages from Gmail
 *
 * CRITICAL: Always return 200 within 10 seconds to prevent Pub/Sub retries.
 * Processing errors are logged but still ACKed.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getValidAccessToken } from '@/lib/gmail/token'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GMAIL_PUBSUB_TOKEN = process.env.GMAIL_PUBSUB_TOKEN || ''

interface GmailHeader {
  name: string
  value: string
}

interface GmailMessagePart {
  mimeType: string
  body?: { data?: string; size?: number }
  parts?: GmailMessagePart[]
  headers?: GmailHeader[]
}

interface GmailMessage {
  id: string
  threadId: string
  payload: {
    mimeType: string
    headers: GmailHeader[]
    body?: { data?: string; size?: number }
    parts?: GmailMessagePart[]
  }
}

interface HistoryRecord {
  messagesAdded?: Array<{ message: { id: string; threadId: string } }>
}

interface HistoryResponse {
  history?: HistoryRecord[]
  historyId: string
}

function getHeader(headers: GmailHeader[], name: string): string {
  const h = headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
  return h?.value || ''
}

function parseFromEmail(fromHeader: string): { name: string; email: string } {
  const match = fromHeader.match(/<([^>]+)>/)
  if (match) {
    const name = fromHeader.replace(/<[^>]+>/, '').trim().replace(/^"|"$/g, '')
    return { name, email: match[1] }
  }
  return { name: '', email: fromHeader.trim() }
}

function extractPlainTextBody(payload: GmailMessage['payload']): string {
  // Direct text/plain body
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8')
  }

  // Multipart — search parts recursively
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf-8')
      }
      if (part.parts) {
        for (const subPart of part.parts) {
          if (subPart.mimeType === 'text/plain' && subPart.body?.data) {
            return Buffer.from(subPart.body.data, 'base64url').toString('utf-8')
          }
        }
      }
    }
  }

  return '(no text body)'
}

async function findOrCreateThread(tenantId: string): Promise<string> {
  // Find the most recent thread for this tenant
  const existing = await prisma.mercuryThread.findFirst({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true },
  })

  if (existing) return existing.id

  // No thread — find any user to own it
  const user = await prisma.user.findFirst({
    select: { id: true },
  })

  if (!user) {
    throw new Error('No users found in system')
  }

  const thread = await prisma.mercuryThread.create({
    data: {
      userId: user.id,
      tenantId,
      title: 'Email Thread',
    },
    select: { id: true },
  })

  return thread.id
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify Pub/Sub token
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')

  if (!GMAIL_PUBSUB_TOKEN || token !== GMAIL_PUBSUB_TOKEN) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Parse Pub/Sub push message
    const body = await request.json()
    const messageData = body?.message?.data
    if (!messageData) {
      return NextResponse.json({ processed: true }, { status: 200 })
    }

    const data = JSON.parse(Buffer.from(messageData, 'base64').toString()) as {
      emailAddress: string
      historyId: string
    }

    // Find agent credential for this email
    const credential = await prisma.agentEmailCredential.findFirst({
      where: { emailAddress: data.emailAddress, isActive: true },
    })

    if (!credential) {
      // Unknown email — ACK but don't process
      return NextResponse.json({ processed: true }, { status: 200 })
    }

    // Get access token
    const accessToken = await getValidAccessToken(credential.agentId)

    // Determine starting history ID
    const startHistoryId = credential.lastHistoryId || data.historyId

    // Fetch message history
    let historyData: HistoryResponse | null = null
    const historyUrl = `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${startHistoryId}&historyTypes=messageAdded`

    const historyResponse = await fetch(historyUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (historyResponse.ok) {
      historyData = (await historyResponse.json()) as HistoryResponse
    } else if (historyResponse.status === 404) {
      // historyId too old — fall back to latest inbox message
      const fallbackUrl =
        'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=in:inbox'
      const fallbackRes = await fetch(fallbackUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (fallbackRes.ok) {
        const fallbackData = (await fallbackRes.json()) as {
          messages?: Array<{ id: string; threadId: string }>
        }
        if (fallbackData.messages?.length) {
          historyData = {
            history: [
              {
                messagesAdded: fallbackData.messages.map((m) => ({
                  message: { id: m.id, threadId: m.threadId },
                })),
              },
            ],
            historyId: data.historyId,
          }
        }
      }
    }

    if (!historyData?.history) {
      // No new messages — update historyId and ACK
      await prisma.agentEmailCredential.update({
        where: { id: credential.id },
        data: { lastHistoryId: data.historyId },
      })
      return NextResponse.json({ processed: true }, { status: 200 })
    }

    // Find the persona to get tenantId
    const persona = await prisma.mercuryPersona.findFirst({
      where: { id: credential.agentId },
      select: { tenantId: true },
    })
    const tenantId = persona?.tenantId || 'default'

    // Process each new message
    const processedMessageIds = new Set<string>()

    for (const historyRecord of historyData.history) {
      if (!historyRecord.messagesAdded) continue

      for (const added of historyRecord.messagesAdded) {
        const messageId = added.message.id

        // Deduplicate within this batch
        if (processedMessageIds.has(messageId)) continue
        processedMessageIds.add(messageId)

        // Deduplicate against existing DB messages (check metadata for gmailMessageId)
        const existingMsg = await prisma.mercuryThreadMessage.findFirst({
          where: {
            channel: 'email',
            metadata: { path: ['gmailMessageId'], equals: messageId },
          },
          select: { id: true },
        })
        if (existingMsg) continue

        // Fetch full message
        const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`
        const msgResponse = await fetch(msgUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (!msgResponse.ok) continue

        const message = (await msgResponse.json()) as GmailMessage
        const headers = message.payload.headers

        const fromHeader = getHeader(headers, 'From')
        const subject = getHeader(headers, 'Subject')
        const inReplyTo = getHeader(headers, 'In-Reply-To')
        const { name: fromName, email: fromEmail } = parseFromEmail(fromHeader)

        // LOOP PREVENTION — skip messages from the agent's own email
        if (fromEmail.toLowerCase() === credential.emailAddress.toLowerCase()) {
          continue
        }

        // Extract body
        const bodyText = extractPlainTextBody(message.payload)

        // Find or create thread for this tenant
        const threadId = await findOrCreateThread(tenantId)

        // Create inbound message in Mercury thread
        await prisma.mercuryThreadMessage.create({
          data: {
            threadId,
            role: 'user',
            channel: 'email',
            content: `Email from ${fromName} <${fromEmail}>:\nSubject: ${subject}\n\n${bodyText}`,
            metadata: {
              gmailMessageId: message.id,
              gmailThreadId: message.threadId,
              from: fromEmail,
              fromName,
              subject,
              inReplyTo: inReplyTo || null,
            },
          },
        })
      }
    }

    // Update lastHistoryId
    const latestHistoryId = historyData.historyId || data.historyId
    await prisma.agentEmailCredential.update({
      where: { id: credential.id },
      data: { lastHistoryId: latestHistoryId },
    })

    return NextResponse.json({ processed: true }, { status: 200 })
  } catch (error) {
    // CRITICAL: Always return 200 to prevent Pub/Sub infinite retries
    logger.error('[Gmail Webhook] Processing error:', error)
    return NextResponse.json({ processed: true }, { status: 200 })
  }
}
