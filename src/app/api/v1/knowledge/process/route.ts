/**
 * Knowledge Event Processor — POST /api/v1/knowledge/process
 *
 * Pub/Sub push endpoint (or manual trigger) that processes knowledge events:
 * 1. Parse message (eventId, documentId, tenantId)
 * 2. Update KnowledgeEvent status → processing
 * 3. Call Go backend POST /api/documents/{id}/ingest-text
 * 4. On success: status → indexed
 * 5. On failure: status → failed
 * 6. Fire callback if configured
 */

import { NextRequest, NextResponse } from 'next/server'
import { writeAuditEntry } from '@/lib/audit/auditWriter'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''

interface PubSubMessage {
  eventId: string
  documentId: string
  tenantId: string
  userId: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Accept either Pub/Sub push format or direct JSON
  let payload: PubSubMessage
  try {
    const body = await request.json()

    // Pub/Sub push format: { message: { data: base64, attributes: {} } }
    if (body.message?.data) {
      const decoded = Buffer.from(body.message.data, 'base64').toString('utf8')
      payload = JSON.parse(decoded)
    } else {
      // Direct JSON call (internal trigger)
      payload = body
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  if (!payload.eventId || !payload.documentId) {
    return NextResponse.json(
      { success: false, error: 'eventId and documentId are required' },
      { status: 400 }
    )
  }

  // Verify internal auth for direct calls
  const authHeader = request.headers.get('x-internal-auth') || ''
  const isPubSub = request.headers.get('user-agent')?.includes('Google-Cloud-Pub/Sub') ?? false
  if (!isPubSub && authHeader !== INTERNAL_AUTH_SECRET && INTERNAL_AUTH_SECRET) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Update event status → processing
    await prisma.knowledgeEvent.update({
      where: { id: payload.eventId },
      data: { status: 'processing' },
    })

    // Call Go backend to process the pre-extracted text
    const response = await fetch(
      `${GO_BACKEND_URL}/api/documents/${payload.documentId}/ingest-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Auth': INTERNAL_AUTH_SECRET,
          'X-User-ID': payload.userId,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(`Go backend returned ${response.status}: ${errorText}`)
    }

    // Update event status → indexed
    const event = await prisma.knowledgeEvent.update({
      where: { id: payload.eventId },
      data: {
        status: 'indexed',
        processedAt: new Date(),
      },
    })

    // Fire callback if configured
    if (event.callbackUrl) {
      fetch(event.callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.eventId,
          status: 'indexed',
          document_id: event.documentId,
          processed_at: event.processedAt?.toISOString(),
        }),
      }).catch((err) => {
        logger.error('[Knowledge Process] Callback failed:', err)
      })
    }

    // Audit
    writeAuditEntry(payload.userId, 'knowledge.indexed', payload.documentId, {
      eventId: payload.eventId,
      status: 'indexed',
    }).catch(() => { /* non-fatal */ })

    return NextResponse.json({ success: true, data: { status: 'indexed' } })
  } catch (error) {
    logger.error('[Knowledge Process] Error:', error)

    // Update event status → failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error'
    const event = await prisma.knowledgeEvent.update({
      where: { id: payload.eventId },
      data: {
        status: 'failed',
        errorDetails: errorMessage.slice(0, 4096),
      },
    }).catch(() => null)

    // Fire callback on failure too
    if (event?.callbackUrl) {
      fetch(event.callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.eventId,
          status: 'failed',
          error: errorMessage.slice(0, 1024),
        }),
      }).catch(() => { /* ignore */ })
    }

    writeAuditEntry(payload.userId, 'knowledge.failed', payload.documentId, {
      eventId: payload.eventId,
      error: errorMessage.slice(0, 512),
    }).catch(() => { /* non-fatal */ })

    return NextResponse.json(
      { success: false, error: 'Processing failed' },
      { status: 500 }
    )
  }
}
