/**
 * Chat API Route - RAGbox.co
 *
 * Proxies queries to the Go backend RAG pipeline.
 * Uses internal auth (X-Internal-Auth + X-User-ID) instead of forwarding OAuth tokens.
 * Handles tool errors and converts them to Mercury-friendly responses.
 * Includes Redis query caching for repeated queries (5-minute TTL).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isToolError, createErrorResponse } from '@/lib/mercury/toolErrors'
import { getCachedQuery, setCachedQuery } from '@/lib/cache/queryCache'

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''

export async function POST(request: NextRequest): Promise<NextResponse | Response> {
  try {
    // Auth check — decode JWT directly from cookie (no internal HTTP call)
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const userId = (token.id as string) || token.email || ''
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unable to determine user identity' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { query, stream, privilegeMode, history, maxTier } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      )
    }

    // Check cache for non-streaming requests (or when explicitly not streaming)
    // Only cache simple queries (no conversation history — those are context-dependent)
    const isSimpleQuery = !history || history.length === 0
    if (isSimpleQuery) {
      const cached = await getCachedQuery(query, userId)
      if (cached) {
        return NextResponse.json({
          success: true,
          data: {
            answer: cached.text,
            confidence: cached.confidence,
            citations: cached.citations,
            fromCache: true,
          },
        })
      }
    }

    // Forward to Go backend with internal auth
    const targetUrl = `${GO_BACKEND_URL}/api/chat`
    const backendResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_AUTH_SECRET,
        'X-User-ID': userId,
      },
      body: JSON.stringify({
        query,
        stream: stream ?? true,
        privilegeMode: privilegeMode ?? false,
        history: history ?? [],
        maxTier: maxTier ?? 3,
      }),
    })

    // If backend returned a tool error
    if (!backendResponse.ok) {
      const errorBody = await backendResponse.json().catch(() => null)

      if (errorBody && isToolError(errorBody.error || errorBody)) {
        const toolError = errorBody.error || errorBody
        const formatted = createErrorResponse(toolError)
        return NextResponse.json({
          success: false,
          response: formatted.response,
          error: formatted.error,
          canRetry: formatted.canRetry,
        })
      }

      return NextResponse.json({
        success: false,
        response: 'I encountered an issue processing your request. Please try again.',
        error: { code: 'UPSTREAM_FAILURE', recoverable: true },
        canRetry: true,
      }, { status: backendResponse.status })
    }

    const contentType = backendResponse.headers.get('content-type') ?? ''

    // Handle SSE streaming response — pass through directly (no caching for streams)
    if (contentType.includes('text/event-stream') && stream) {
      return new Response(backendResponse.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // Handle JSON response — cache if it's a simple query with a successful answer
    const data = await backendResponse.json()

    if (isSimpleQuery && data.success !== false) {
      const answer = data.data?.answer ?? data.answer
      const confidence = data.data?.confidence ?? data.confidence
      const citations = data.data?.citations ?? data.citations ?? []
      if (answer) {
        setCachedQuery(query, userId, {
          text: answer,
          confidence,
          citations,
          cachedAt: new Date().toISOString(),
        }).catch(() => {})
      }
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({
      success: false,
      response: 'I encountered an unexpected issue. Please try again, and if this persists, contact support.',
      error: { code: 'INTERNAL_ERROR', recoverable: true },
      canRetry: true,
    }, { status: 500 })
  }
}
