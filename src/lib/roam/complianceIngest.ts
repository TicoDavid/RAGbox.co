/**
 * ROAM Compliance Ingest Pipeline
 *
 * Fetches daily compliance export → groups into conversations →
 * creates synthetic documents → uploads to GCS → publishes to Pub/Sub.
 */

import { fetchComplianceExport, parseComplianceNdjson, extractTextContent, groupByChat } from './complianceExport'
import type { TextMessage } from './complianceExport'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''
const DEFAULT_USER_ID = process.env.ROAM_DEFAULT_USER_ID || process.env.WHATSAPP_DEFAULT_USER_ID || ''
const MIN_MESSAGES_PER_CONVERSATION = 3

// ── Types ──────────────────────────────────────────────────

export interface IngestResult {
  date: string
  conversationsIngested: number
  messagesProcessed: number
  documentsCreated: string[]
  errors: string[]
}

// ── Main Pipeline ──────────────────────────────────────────

/**
 * Full daily compliance ingest pipeline.
 * @param date    YYYY-MM-DD or "yesterday"
 * @param apiKey  Per-tenant key override (falls back to env var)
 */
export async function ingestDailyCompliance(date: string, apiKey?: string): Promise<IngestResult> {
  const resolvedDate = date === 'yesterday'
    ? formatDate(new Date(Date.now() - 86400000))
    : date

  const result: IngestResult = {
    date: resolvedDate,
    conversationsIngested: 0,
    messagesProcessed: 0,
    documentsCreated: [],
    errors: [],
  }

  logger.info(`[Compliance Ingest] Starting for date: ${resolvedDate}`)

  // 1. Fetch compliance export
  let ndjson: string
  try {
    ndjson = await fetchComplianceExport(resolvedDate, apiKey)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    logger.error('[Compliance Ingest] Fetch failed:', msg)
    result.errors.push(`Fetch failed: ${msg}`)
    return result
  }

  // 2. Parse and extract text content
  const events = parseComplianceNdjson(ndjson)
  const messages = extractTextContent(events)
  result.messagesProcessed = messages.length

  if (messages.length === 0) {
    logger.info('[Compliance Ingest] No text messages found')
    return result
  }

  // 3. Group by chatId
  const conversations = groupByChat(messages)

  // 4. Process each conversation with enough messages
  for (const [chatId, msgs] of conversations) {
    if (msgs.length < MIN_MESSAGES_PER_CONVERSATION) continue

    try {
      const docContent = formatConversationDocument(msgs, resolvedDate, chatId)
      const shortId = chatId.slice(0, 8)
      const title = `ROAM Conversation — ${resolvedDate} — ${shortId}`

      // Create document record in database
      const doc = await prisma.document.create({
        data: {
          userId: DEFAULT_USER_ID,
          filename: `roam-${resolvedDate}-${shortId}.txt`,
          originalName: title,
          mimeType: 'text/plain',
          fileType: 'txt',
          sizeBytes: Buffer.byteLength(docContent, 'utf-8'),
          extractedText: docContent,
          indexStatus: 'Pending',
          metadata: {
            source: 'roam_compliance',
            date: resolvedDate,
            chatId,
            messageCount: msgs.length,
            participants: [...new Set(msgs.map((m) => m.senderName))],
          },
        },
      })

      // Trigger indexing via Go backend
      try {
        await fetch(`${GO_BACKEND_URL}/api/documents/${doc.id}/index`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Auth': INTERNAL_AUTH_SECRET,
            'X-User-ID': DEFAULT_USER_ID,
          },
          body: JSON.stringify({ text: docContent }),
        })
      } catch (indexErr) {
        logger.warn(`[Compliance Ingest] Index trigger failed for ${doc.id}:`, indexErr)
        // Non-fatal — document is stored, can be indexed later
      }

      result.documentsCreated.push(doc.id)
      result.conversationsIngested++
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      result.errors.push(`Chat ${chatId}: ${msg}`)
    }
  }

  logger.info(
    `[Compliance Ingest] Done: ${result.conversationsIngested} conversations, ` +
    `${result.messagesProcessed} messages, ${result.errors.length} errors`
  )

  // 5. Write audit record
  try {
    await prisma.mercuryAction.create({
      data: {
        userId: DEFAULT_USER_ID,
        actionType: 'compliance_export',
        status: result.errors.length > 0 ? 'partial' : 'completed',
        metadata: {
          date: resolvedDate,
          conversationsIngested: result.conversationsIngested,
          messagesProcessed: result.messagesProcessed,
          documentsCreated: result.documentsCreated.length,
          errorCount: result.errors.length,
        },
      },
    })
  } catch {
    logger.warn('[Compliance Ingest] Audit write failed')
  }

  return result
}

// ── Helpers ────────────────────────────────────────────────

/**
 * Format a conversation as a readable text document.
 */
export function formatConversationDocument(
  messages: TextMessage[],
  date: string,
  chatId: string,
): string {
  const participants = [...new Set(messages.map((m) => m.senderName))]
  const dateDisplay = new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const lines: string[] = [
    `ROAM Conversation Export — ${dateDisplay}`,
    `Chat: ${chatId}`,
    `Participants: ${participants.join(', ')}`,
    `Messages: ${messages.length}`,
    '',
    '---',
    '',
  ]

  for (const msg of messages) {
    const time = msg.timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    lines.push(`[${time}] ${msg.senderName}: ${msg.text}`)
  }

  return lines.join('\n')
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}
