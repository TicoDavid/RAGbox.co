/**
 * Chat API - RAGbox.co
 *
 * POST /api/chat
 * Supports direct chat, RAG-grounded responses, and vector pipeline
 */

import { NextRequest, NextResponse } from 'next/server'
import { ragClient } from '@/lib/vertex/rag-client'
import { executeRAGPipeline } from '@/lib/rag/pipeline'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { MERCURY_SYSTEM_PROMPT } from '@/mercury/systemPrompt'
import { sanitizeMercuryOutput, sanitizeChunk } from '@/mercury/outputFirewall'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GREETING_PATTERNS = [
  /^(hi|hello|hey|good\s*(morning|afternoon|evening))(\s|$)/i,
  /^(what's up|how are you|how's it going)/i,
  /^(thanks|thank you|thx)/i,
  /^(status|ready|are you there)/i,
]

function isGreeting(query: string): boolean {
  const trimmed = query.trim().toLowerCase()
  return GREETING_PATTERNS.some(pattern => pattern.test(trimmed))
}

interface ChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const {
      query,
      context = [],
      stream = false,
      history = [] as ChatHistoryMessage[],
      systemPrompt,
      useVectorPipeline = false,
      privilegeMode = false,
      maxTier = 3,
    } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      )
    }

    const userId = (session.user as { id?: string }).id || session.user.email || 'unknown'

    console.log(`[Chat API] Query: "${query.substring(0, 50)}..." | Context: ${context.length} docs | History: ${history.length} turns | Vector: ${useVectorPipeline} | Stream: ${stream}`)

    // Enforce Mercury system prompt on every call
    const effectiveSystemPrompt = MERCURY_SYSTEM_PROMPT + (systemPrompt ? `\n\n${systemPrompt}` : '')

    // GREETING FILTER
    if (isGreeting(query)) {
      const response = await ragClient.chat(query, {
        systemPrompt: effectiveSystemPrompt,
        history,
      })

      const fw = sanitizeMercuryOutput(response.answer)

      return NextResponse.json({
        success: true,
        data: {
          answer: fw.sanitized,
          confidence: 1.0,
          citations: [],
          silenceProtocol: false,
          greeting: true,
        },
      })
    }

    // VECTOR PIPELINE MODE
    if (useVectorPipeline) {
      const result = await executeRAGPipeline(query, {
        userId,
        privilegeMode,
        maxTier,
        systemPrompt: effectiveSystemPrompt,
        history,
      })

      const fw = sanitizeMercuryOutput(result.answer)

      return NextResponse.json({
        success: true,
        data: {
          answer: fw.sanitized,
          confidence: result.confidence,
          citations: result.citations,
          silenceProtocol: result.silenceProtocol,
          chunksUsed: result.chunksUsed,
          latencyMs: result.latencyMs,
          retrievedChunks: result.retrievedChunks.map(c => ({
            documentName: c.documentName,
            similarity: c.similarity,
            excerpt: c.content.substring(0, 200),
          })),
        },
      })
    }

    // STREAMING RESPONSE
    if (stream) {
      const encoder = new TextEncoder()
      const readable = new ReadableStream({
        async start(controller) {
          try {
            if (context.length > 0) {
              const response = await ragClient.query(query, context, { systemPrompt: effectiveSystemPrompt, history })
              const fw = sanitizeMercuryOutput(response.answer)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'complete',
                answer: fw.sanitized,
                confidence: response.confidence,
                citations: response.citations,
              })}\n\n`))
            } else {
              await ragClient.chatStream(query, {
                systemPrompt: effectiveSystemPrompt,
                history,
                onToken: (token) => {
                  const clean = sanitizeChunk(token)
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', content: clean })}\n\n`))
                },
                onComplete: (fullText) => {
                  const fw = sanitizeMercuryOutput(fullText)
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', fullText: fw.sanitized })}\n\n`))
                },
                onError: (error) => {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`))
                },
              })
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`))
          } finally {
            controller.close()
          }
        },
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // CONTEXT-BASED RAG (legacy mode)
    if (context.length > 0) {
      const response = await ragClient.query(query, context, { systemPrompt: effectiveSystemPrompt, history })

      const confidenceThreshold = parseFloat(process.env.AEGIS_CONFIDENCE_THRESHOLD || '0.85')
      const hasHistory = history.length > 0
      const effectiveConfidenceThreshold = hasHistory ? confidenceThreshold * 0.8 : confidenceThreshold

      if (response.confidence < effectiveConfidenceThreshold) {
        return NextResponse.json({
          success: true,
          data: {
            answer: 'I cannot provide a confident answer based on your documents. Please upload more relevant materials or rephrase your question.',
            confidence: response.confidence,
            silenceProtocol: true,
            citations: [],
          },
        })
      }

      const fw = sanitizeMercuryOutput(response.answer)

      return NextResponse.json({
        success: true,
        data: {
          answer: fw.sanitized,
          confidence: response.confidence,
          citations: response.citations,
          silenceProtocol: false,
        },
      })
    }

    // DIRECT CHAT MODE
    const response = await ragClient.chat(query, { systemPrompt: effectiveSystemPrompt, history })
    const fw = sanitizeMercuryOutput(response.answer)

    return NextResponse.json({
      success: true,
      data: {
        answer: fw.sanitized,
        confidence: 0.95,
        citations: [],
        silenceProtocol: false,
      },
    })
  } catch (error) {
    console.error('[Chat API] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate response',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    )
  }
}
