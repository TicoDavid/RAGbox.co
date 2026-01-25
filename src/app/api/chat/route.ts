import { NextRequest, NextResponse } from 'next/server';
import { ragClient } from '@/lib/vertex/rag-client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Greeting patterns that should bypass RAG and get conversational responses
const GREETING_PATTERNS = [
  /^(hi|hello|hey|good\s*(morning|afternoon|evening))(\s|$)/i,
  /^(what's up|how are you|how's it going)/i,
  /^(thanks|thank you|thx)/i,
  /^(status|ready|are you there)/i,
];

function isGreeting(query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  return GREETING_PATTERNS.some(pattern => pattern.test(trimmed));
}

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * POST /api/chat
 *
 * Chat endpoint using Vertex AI Gemini
 * Supports:
 * - Direct chat and RAG-grounded responses
 * - Chat history for context continuity
 * - Protocol system prompts (Legal, Executive, Analyst modes)
 * - Greeting filter (bypass RAG for casual greetings)
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      query,
      context = [],
      stream = false,
      history = [] as ChatHistoryMessage[],
      systemPrompt,
    } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    console.log(`[Chat API] Query: "${query.substring(0, 50)}..." | Context: ${context.length} docs | History: ${history.length} turns | Protocol: ${systemPrompt ? 'custom' : 'default'} | Stream: ${stream}`);

    // GREETING FILTER: Bypass RAG for casual greetings
    if (isGreeting(query)) {
      console.log('[Chat API] Greeting detected - conversational response');
      const response = await ragClient.chat(query, {
        systemPrompt: systemPrompt || 'You are Mercury, a helpful intelligence assistant. Respond naturally to greetings.',
        history,
      });

      return NextResponse.json({
        success: true,
        data: {
          answer: response.answer,
          confidence: 1.0,
          citations: [],
          silenceProtocol: false,
          greeting: true,
        },
      });
    }

    // Streaming response
    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            if (context.length > 0) {
              // RAG mode with context
              const response = await ragClient.query(query, context, {
                systemPrompt,
                history,
              });
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'complete',
                answer: response.answer,
                confidence: response.confidence,
                citations: response.citations
              })}\n\n`));
            } else {
              // Direct chat mode - stream tokens
              await ragClient.chatStream(query, {
                systemPrompt,
                history,
                onToken: (token) => {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`));
                },
                onComplete: (fullText) => {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', fullText })}\n\n`));
                },
                onError: (error) => {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
                }
              });
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message })}\n\n`));
          } finally {
            controller.close();
          }
        }
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming response
    if (context.length > 0) {
      // RAG mode - use query with context + history + system prompt
      const response = await ragClient.query(query, context, {
        systemPrompt,
        history,
      });

      // Apply Silence Protocol (but with history context, we're more flexible)
      const confidenceThreshold = parseFloat(process.env.AEGIS_CONFIDENCE_THRESHOLD || '0.85');
      const hasHistory = history.length > 0;

      // Lower threshold if we have conversation history (follow-up questions)
      const effectiveThreshold = hasHistory ? confidenceThreshold * 0.8 : confidenceThreshold;

      if (response.confidence < effectiveThreshold) {
        return NextResponse.json({
          success: true,
          data: {
            answer: "I cannot provide a confident answer based on your documents. Please upload more relevant materials or rephrase your question.",
            confidence: response.confidence,
            silenceProtocol: true,
            citations: [],
          },
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          answer: response.answer,
          confidence: response.confidence,
          citations: response.citations,
          silenceProtocol: false,
        },
      });
    } else {
      // Direct chat mode - no document context but may have history
      const response = await ragClient.chat(query, {
        systemPrompt,
        history,
      });

      return NextResponse.json({
        success: true,
        data: {
          answer: response.answer,
          confidence: 0.95,
          citations: [],
          silenceProtocol: false,
          model: response.model,
        },
      });
    }
  } catch (error) {
    console.error('[Chat API] Error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate response',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: 500 }
    );
  }
}
