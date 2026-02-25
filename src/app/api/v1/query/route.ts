/**
 * RAGbox Public API — Query Endpoint
 *
 * POST /api/v1/query — RAG query via API key authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateApiKey, hasScope } from '@/lib/api/apiKeyMiddleware'
import { parseSSEText } from '@/lib/mercury/sseParser'
import { writeAuditEntry } from '@/lib/audit/auditWriter'
import { toCitationBlocks } from '@/lib/citations/transform'
import { logger } from '@/lib/logger'

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''
const SILENCE_THRESHOLD = 0.65

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await authenticateApiKey(request)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
  }

  if (!hasScope(auth, 'read')) {
    return NextResponse.json({ success: false, error: 'Insufficient permissions. "read" scope required.' }, { status: 403 })
  }

  let body: { query?: string; documentIds?: string[]; confidenceThreshold?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.query || typeof body.query !== 'string' || !body.query.trim()) {
    return NextResponse.json({ success: false, error: 'Query text is required' }, { status: 400 })
  }

  const threshold = body.confidenceThreshold ?? SILENCE_THRESHOLD

  try {
    const ragResponse = await fetch(`${GO_BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_AUTH_SECRET,
        'X-User-ID': auth.userId,
      },
      body: JSON.stringify({
        query: body.query.trim(),
        mode: 'concise',
        privilegeMode: false,
        maxTier: 3,
        history: [],
      }),
    })

    if (!ragResponse.ok) {
      return NextResponse.json(
        { success: false, error: 'RAG pipeline unavailable' },
        { status: 502 }
      )
    }

    const responseText = await ragResponse.text()
    const parsed = parseSSEText(responseText)

    // Silence Protocol
    if (parsed.isSilence || (parsed.confidence !== undefined && parsed.confidence < threshold)) {
      await writeAuditEntry(auth.userId, 'query.response', auth.keyId, {
        query: body.query.slice(0, 200),
        confidence: parsed.confidence,
        silenceProtocol: true,
        channel: 'api',
      })

      return NextResponse.json({
        success: true,
        data: {
          answer: null,
          confidence: parsed.confidence ?? 0,
          citations: [],
          silenceProtocol: true,
          reasoning: 'Confidence below threshold. Mercury refuses to speculate.',
          suggestions: parsed.suggestions || [],
        },
      })
    }

    const citations = parsed.citations.map((c) => ({
      index: c.index,
      documentId: c.documentId,
      documentName: c.documentName || 'Document',
      excerpt: c.excerpt,
    }))

    // Build structured citation blocks
    const citationBlocks = toCitationBlocks(
      parsed.citations.map((c, i) => ({
        citationIndex: c.index ?? i,
        documentId: c.documentId,
        documentName: c.documentName || 'Document',
        excerpt: c.excerpt,
        relevanceScore: parsed.confidence ?? 0,
      })),
      body.query,
      parsed.text
    )

    await writeAuditEntry(auth.userId, 'query.response', auth.keyId, {
      query: body.query.slice(0, 200),
      confidence: parsed.confidence,
      citationCount: citations.length,
      channel: 'api',
    })

    return NextResponse.json({
      success: true,
      data: {
        answer: parsed.text,
        confidence: parsed.confidence ?? 0,
        citations,
        citationBlocks,
        silenceProtocol: false,
      },
    })
  } catch (error) {
    logger.error('[API v1/query] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
