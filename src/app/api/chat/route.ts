/**
 * Chat API Route - RAGbox.co
 *
 * Proxies queries to the Go backend RAG pipeline.
 * Uses internal auth (X-Internal-Auth + X-User-ID) instead of forwarding OAuth tokens.
 * Handles tool errors and converts them to Mercury-friendly responses.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isToolError, createErrorResponse } from '@/lib/mercury/toolErrors'

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''

export async function POST(request: NextRequest): Promise<NextResponse | Response> {
  console.error('[CHAT ROUTE HIT]', { GO_BACKEND_URL, INTERNAL_AUTH_SECRET_LEN: INTERNAL_AUTH_SECRET.length })
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

    // Forward to Go backend with internal auth
    const targetUrl = `${GO_BACKEND_URL}/api/chat`
    console.error('[CHAT ROUTE] forwarding to backend', { targetUrl, userId, queryLen: query.length, stream })
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
      console.error('[CHAT ROUTE] backend returned non-ok', { status: backendResponse.status, statusText: backendResponse.statusText })
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

    // Handle SSE streaming response — pass through directly
    if (contentType.includes('text/event-stream') && stream) {
      return new Response(backendResponse.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // Handle JSON response
    const data = await backendResponse.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[CHAT ROUTE] CAUGHT ERROR', err instanceof Error ? { message: err.message, cause: err.cause, stack: err.stack?.split('\n').slice(0, 5) } : err)
    return NextResponse.json({
      success: false,
      response: 'I encountered an unexpected issue. Please try again, and if this persists, contact support.',
      error: { code: 'INTERNAL_ERROR', recoverable: true },
      canRetry: true,
    }, { status: 500 })
  }
}
