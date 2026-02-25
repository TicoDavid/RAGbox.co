/**
 * Webhook Knowledge Ingestion — POST /api/v1/knowledge/ingest
 *
 * Accepts structured knowledge events from external systems.
 * Creates a Document + KnowledgeEvent, publishes to Pub/Sub, returns 202.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PubSub } from '@google-cloud/pubsub'
import { authenticateApiKey, hasScope } from '@/lib/api/apiKeyMiddleware'
import { writeAuditEntry } from '@/lib/audit/auditWriter'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'ragbox-sovereign-prod'
const PUBSUB_TOPIC = 'ragbox-knowledge-ingest'
const MAX_CONTENT_BYTES = 1_048_576 // 1 MB

// ── Rate limiting (sliding window) ──────────────────────────────────

const rateLimitWindow = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 100 // events per minute per tenant
const WINDOW_MS = 60_000

function checkRateLimit(tenantId: string): boolean {
  const now = Date.now()
  const entry = rateLimitWindow.get(tenantId)
  if (!entry || now > entry.resetAt) {
    rateLimitWindow.set(tenantId, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

// ── Pub/Sub client ──────────────────────────────────────────────────

let pubsubClient: PubSub | null = null
function getPubSub(): PubSub {
  if (!pubsubClient) {
    pubsubClient = new PubSub({ projectId: GCP_PROJECT })
  }
  return pubsubClient
}

// ── Validation schema ───────────────────────────────────────────────

const ALLOWED_CONTENT_TYPES = ['text/plain', 'text/markdown', 'text/html', 'application/json'] as const

const ingestPayloadSchema = z.object({
  event_id: z.string().min(1).max(256),
  source_id: z.string().min(1).max(256),
  source_name: z.string().max(256).optional(),
  title: z.string().min(1).max(512),
  content_type: z.enum(ALLOWED_CONTENT_TYPES),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  privilege_level: z.enum(['standard', 'confidential', 'privileged']).default('standard'),
  tags: z.array(z.string().max(64)).max(20).default([]),
  expires_at: z.string().datetime().optional(),
  callback_url: z.string().url().max(2048).optional(),
})

// ── File type derivation ────────────────────────────────────────────

function fileTypeFromContentType(ct: string): string {
  switch (ct) {
    case 'text/plain': return 'txt'
    case 'text/markdown': return 'md'
    case 'text/html': return 'html'
    case 'application/json': return 'json'
    default: return 'txt'
  }
}

// ── POST handler ────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth
  const auth = await authenticateApiKey(request)
  if (!auth) {
    return NextResponse.json(
      { success: false, error: 'Invalid or missing API key' },
      { status: 401 }
    )
  }

  if (!hasScope(auth, 'write')) {
    return NextResponse.json(
      { success: false, error: 'Insufficient permissions. "write" scope required.' },
      { status: 403 }
    )
  }

  // Rate limit
  if (!checkRateLimit(auth.tenantId)) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded. Max 100 events/min/tenant.' },
      { status: 429 }
    )
  }

  // Parse & validate
  let body: z.infer<typeof ingestPayloadSchema>
  try {
    const raw = await request.json()
    body = ingestPayloadSchema.parse(raw)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: err.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  // Content size check
  if (Buffer.byteLength(body.content, 'utf8') > MAX_CONTENT_BYTES) {
    return NextResponse.json(
      { success: false, error: 'Content exceeds 1MB limit' },
      { status: 413 }
    )
  }

  // Idempotency check
  const existing = await prisma.knowledgeEvent.findUnique({
    where: {
      tenantId_eventId: {
        tenantId: auth.tenantId,
        eventId: body.event_id,
      },
    },
    select: { id: true, status: true, documentId: true },
  })

  if (existing) {
    return NextResponse.json({
      success: true,
      data: {
        event_id: body.event_id,
        status: 'already_processed',
        document_id: existing.documentId,
      },
    }, { status: 202 })
  }

  // Create Document + KnowledgeEvent in a transaction
  const fileType = fileTypeFromContentType(body.content_type)
  const filename = `${body.source_id}_${body.event_id}.${fileType}`

  const result = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        filename,
        originalName: body.title,
        mimeType: body.content_type,
        fileType,
        sizeBytes: Buffer.byteLength(body.content, 'utf8'),
        extractedText: body.content,
        indexStatus: 'Pending',
        deletionStatus: 'Active',
        privilegeLevel: body.privilege_level,
        isPrivileged: body.privilege_level === 'privileged',
        metadata: {
          sourceId: body.source_id,
          sourceName: body.source_name ?? body.source_id,
          sourceType: 'webhook_ingest',
          tags: body.tags,
          ...(body.metadata ?? {}),
        },
      },
    })

    const event = await tx.knowledgeEvent.create({
      data: {
        tenantId: auth.tenantId,
        userId: auth.userId,
        eventId: body.event_id,
        sourceId: body.source_id,
        sourceName: body.source_name,
        title: body.title,
        contentType: body.content_type,
        documentId: doc.id,
        privilegeLevel: body.privilege_level,
        tags: body.tags,
        metadata: body.metadata !== undefined ? JSON.parse(JSON.stringify(body.metadata)) : undefined,
        expiresAt: body.expires_at ? new Date(body.expires_at) : undefined,
        callbackUrl: body.callback_url,
      },
    })

    return { doc, event }
  })

  // Fire-and-forget Pub/Sub publish
  getPubSub()
    .topic(PUBSUB_TOPIC)
    .publishMessage({
      data: Buffer.from(JSON.stringify({
        eventId: result.event.id,
        documentId: result.doc.id,
        tenantId: auth.tenantId,
        userId: auth.userId,
      })),
      attributes: {
        eventId: body.event_id,
        sourceId: body.source_id,
        receivedAt: new Date().toISOString(),
      },
    })
    .catch((err: unknown) => {
      logger.error('[Knowledge Ingest] Pub/Sub publish failed:', err)
    })

  // Audit (non-blocking)
  writeAuditEntry(auth.userId, 'knowledge.ingest', result.doc.id, {
    eventId: body.event_id,
    sourceId: body.source_id,
    title: body.title,
    contentType: body.content_type,
    channel: 'api',
  }).catch(() => { /* non-fatal */ })

  return NextResponse.json({
    success: true,
    data: {
      event_id: body.event_id,
      status: 'received',
      document_id: result.doc.id,
      estimated_ready_at: new Date(Date.now() + 30_000).toISOString(),
    },
  }, { status: 202 })
}
