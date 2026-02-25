/**
 * LLM Connection Test API — BYOLLM Dry-Run
 *
 * POST /api/settings/llm/test
 *
 * Tests connectivity to a user-provided LLM provider with a minimal
 * completion request. Measures latency. Does NOT store anything.
 *
 * Supported providers: openrouter, openai, anthropic, google
 *
 * STORY-021
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const VALID_PROVIDERS = ['openrouter', 'openai', 'anthropic', 'google'] as const

const TestSchema = z.object({
  provider: z.enum(VALID_PROVIDERS),
  apiKey: z.string().min(1).max(500),
  baseUrl: z.string().url().max(500).optional(),
  model: z.string().min(1).max(200).optional(),
})

/** Minimal test prompt — fast, cheap, verifiable. */
const TEST_PROMPT = 'Respond with exactly one word: "connected"'

/** Provider endpoint config. */
interface ProviderConfig {
  url: string
  buildHeaders: (apiKey: string) => Record<string, string>
  buildBody: (model: string) => unknown
  extractResponse: (data: unknown) => string
}

function getProviderConfig(
  provider: string,
  apiKey: string,
  baseUrl?: string,
  model?: string,
): ProviderConfig {
  switch (provider) {
    case 'openrouter':
      return {
        url: baseUrl ?? 'https://openrouter.ai/api/v1/chat/completions',
        buildHeaders: (key) => ({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': 'https://app.ragbox.co',
          'X-Title': 'RAGbox BYOLLM Test',
        }),
        buildBody: (m) => ({
          model: m || 'anthropic/claude-sonnet-4-20250514',
          messages: [{ role: 'user', content: TEST_PROMPT }],
          max_tokens: 10,
        }),
        extractResponse: (data) => {
          const d = data as { choices?: Array<{ message?: { content?: string } }> }
          return d.choices?.[0]?.message?.content ?? ''
        },
      }

    case 'openai':
      return {
        url: baseUrl ?? 'https://api.openai.com/v1/chat/completions',
        buildHeaders: (key) => ({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        }),
        buildBody: (m) => ({
          model: m || 'gpt-4o-mini',
          messages: [{ role: 'user', content: TEST_PROMPT }],
          max_tokens: 10,
        }),
        extractResponse: (data) => {
          const d = data as { choices?: Array<{ message?: { content?: string } }> }
          return d.choices?.[0]?.message?.content ?? ''
        },
      }

    case 'anthropic':
      return {
        url: baseUrl ?? 'https://api.anthropic.com/v1/messages',
        buildHeaders: (key) => ({
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        }),
        buildBody: (m) => ({
          model: m || 'claude-sonnet-4-20250514',
          messages: [{ role: 'user', content: TEST_PROMPT }],
          max_tokens: 10,
        }),
        extractResponse: (data) => {
          const d = data as { content?: Array<{ text?: string }> }
          return d.content?.[0]?.text ?? ''
        },
      }

    case 'google':
      return {
        url: baseUrl ??
          `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`,
        buildHeaders: () => ({
          'Content-Type': 'application/json',
        }),
        buildBody: () => ({
          contents: [{ parts: [{ text: TEST_PROMPT }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
        extractResponse: (data) => {
          const d = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
          return d.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        },
      }

    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

// ── POST /api/settings/llm/test ─────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    const body = await request.json()
    const parsed = TestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { provider, apiKey, baseUrl, model } = parsed.data
    const config = getProviderConfig(provider, apiKey, baseUrl, model)
    const headers = config.buildHeaders(apiKey)
    const requestBody = config.buildBody(model ?? '')

    const startMs = Date.now()

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)

    let providerResponse: Response
    try {
      providerResponse = await fetch(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })
    } catch (fetchError) {
      clearTimeout(timeout)
      const latencyMs = Date.now() - startMs

      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
        return NextResponse.json({
          success: false,
          latencyMs,
          error: 'Connection timed out after 30 seconds',
        })
      }

      return NextResponse.json({
        success: false,
        latencyMs,
        error: fetchError instanceof Error ? fetchError.message : 'Connection failed',
      })
    }

    clearTimeout(timeout)
    const latencyMs = Date.now() - startMs

    if (!providerResponse.ok) {
      const errorBody = await providerResponse.text().catch(() => '')
      let errorMessage = `Provider returned ${providerResponse.status}`

      try {
        const parsed = JSON.parse(errorBody)
        errorMessage = parsed.error?.message ?? parsed.message ?? errorMessage
      } catch {
        // Use status-based message
      }

      return NextResponse.json({
        success: false,
        latencyMs,
        error: errorMessage,
        statusCode: providerResponse.status,
      })
    }

    const responseData = await providerResponse.json()
    const responseText = config.extractResponse(responseData)

    return NextResponse.json({
      success: true,
      latencyMs,
      response: responseText.trim().slice(0, 100),
      model: model ?? 'default',
    })
  } catch (error) {
    logger.error('[Settings/LLM/Test] error:', error)
    return NextResponse.json(
      { success: false, error: 'Test failed unexpectedly', latencyMs: 0 },
      { status: 500 },
    )
  }
}
