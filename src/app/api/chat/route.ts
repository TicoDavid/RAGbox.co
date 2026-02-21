/**
 * Chat API Route - RAGbox.co
 *
 * Proxies queries to the Go backend RAG pipeline.
 * Uses internal auth (X-Internal-Auth + X-User-ID) instead of forwarding OAuth tokens.
 * Handles tool errors and converts them to Mercury-friendly responses.
 * Includes Redis query caching for repeated queries (5-minute TTL).
 *
 * BYOLLM (STORY-022): When the frontend sends llmProvider=byollm,
 * this proxy reads the tenant's LLMConfig from the DB, decrypts the
 * API key, and forwards provider/model/key to the Go backend.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isToolError, createErrorResponse } from '@/lib/mercury/toolErrors'
import { getCachedQuery, setCachedQuery } from '@/lib/cache/queryCache'
import prisma from '@/lib/prisma'
import { decryptKey } from '@/lib/utils/kms'
import { validateExternalUrl } from '@/lib/utils/url-validation'

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''
const DEFAULT_TENANT = 'default'

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
    const { query, stream, privilegeMode, history, maxTier, personaId, safetyMode, documentScope } = body

    // Incognito mode: skip cache reads/writes and audit trail
    const incognito = request.headers.get('x-incognito') === 'true'

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      )
    }

    // ── Safety Mode: URL fetching when unsafe ──────────
    // safetyMode=true (default) → vault-only, no external URL fetching
    // safetyMode=false → extract URLs from query, fetch content, prepend to context
    // SSRF protection: block private IPs, GCP metadata, non-HTTP schemes (5s timeout)
    let webContext = ''
    if (safetyMode === false) {
      const urlPattern = /https?:\/\/[^\s)>\]]+/gi
      const urls = query.match(urlPattern)
      if (urls && urls.length > 0) {
        const targetUrl = urls[0]
        const validation = validateExternalUrl(targetUrl)
        if (!validation.ok) {
          console.warn(`[Chat] SSRF blocked: ${validation.reason} — ${targetUrl}`)
        } else {
          try {
            const urlRes = await fetch(validation.url.href, {
              headers: { 'User-Agent': 'RAGbox/1.0 (knowledge-assistant)' },
              signal: AbortSignal.timeout(5000),
            })
            if (urlRes.ok) {
              const contentType = urlRes.headers.get('content-type') ?? ''
              if (contentType.includes('text/html') || contentType.includes('text/plain')) {
                const rawText = await urlRes.text()
                const cleanText = rawText
                  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                  .replace(/<[^>]+>/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .slice(0, 8000)
                if (cleanText.length > 50) {
                  webContext = `[Web content from ${targetUrl}]:\n${cleanText}\n\n`
                }
              }
            }
          } catch (err) {
            console.warn('[Chat] URL fetch failed (continuing without web context):', err)
          }
        }
      }
    }

    // Build the effective query — prepend web context if fetched
    const effectiveQuery = webContext ? `${webContext}User question: ${query}` : query

    // Check cache for non-streaming requests (or when explicitly not streaming)
    // Only cache simple queries (no conversation history — those are context-dependent)
    const isSimpleQuery = !history || history.length === 0
    if (isSimpleQuery && !incognito) {
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

    // ── BYOLLM: resolve provider routing (STORY-022) ──────────
    const { llmProvider, llmModel } = body
    let byollmFields: Record<string, string> = {}

    if (llmProvider === 'byollm') {
      try {
        const llmConfig = await prisma.lLMConfig.findUnique({
          where: { tenantId: DEFAULT_TENANT },
        })

        if (llmConfig) {
          const policy = llmConfig.policy ?? 'choice'

          // aegis_only: ignore BYOLLM even if frontend requests it
          if (policy !== 'aegis_only') {
            const rawKey = await decryptKey(llmConfig.apiKeyEncrypted)
            byollmFields = {
              llmProvider: llmConfig.provider,
              llmModel: llmModel || llmConfig.defaultModel || '',
              llmApiKey: rawKey,
              ...(llmConfig.baseUrl ? { llmBaseUrl: llmConfig.baseUrl } : {}),
            }
            console.info('[Chat] BYOLLM active', { provider: byollmFields.llmProvider, model: byollmFields.llmModel })
          }
        }
      } catch (err) {
        console.error('[Chat] BYOLLM config lookup failed (falling back to AEGIS):', err)
      }
    } else {
      // Check if policy forces BYOLLM even when frontend didn't request it
      try {
        const llmConfig = await prisma.lLMConfig.findUnique({
          where: { tenantId: DEFAULT_TENANT },
        })

        if (llmConfig?.policy === 'byollm_only') {
          const rawKey = await decryptKey(llmConfig.apiKeyEncrypted)
          byollmFields = {
            llmProvider: llmConfig.provider,
            llmModel: llmConfig.defaultModel || '',
            llmApiKey: rawKey,
            ...(llmConfig.baseUrl ? { llmBaseUrl: llmConfig.baseUrl } : {}),
          }
        }
      } catch (err) {
        console.error('[Chat] BYOLLM policy check failed (falling back to AEGIS):', err)
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
        query: effectiveQuery,
        stream: stream ?? true,
        privilegeMode: privilegeMode ?? false,
        history: history ?? [],
        maxTier: maxTier ?? 3,
        ...(personaId ? { persona: personaId } : {}),
        ...(documentScope ? { documentScope } : {}),
        ...byollmFields,
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

    if (isSimpleQuery && !incognito && data.success !== false) {
      const answer = data.data?.answer ?? data.answer
      const confidence = data.data?.confidence ?? data.confidence
      const citations = data.data?.citations ?? data.citations ?? []
      if (answer) {
        setCachedQuery(query, userId, {
          text: answer,
          confidence,
          citations,
          cachedAt: new Date().toISOString(),
        }).catch((err) => {
          console.warn('[Chat] Cache write failed:', err)
        })
      }
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[Chat] Unhandled error in POST /api/chat:', err)
    return NextResponse.json({
      success: false,
      response: 'I encountered an unexpected issue. Please try again, and if this persists, contact support.',
      error: { code: 'INTERNAL_ERROR', recoverable: true },
      canRetry: true,
    }, { status: 500 })
  }
}
