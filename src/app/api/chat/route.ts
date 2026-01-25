import { NextRequest, NextResponse } from 'next/server';
import { ragClient } from '@/lib/vertex/rag-client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/chat
 *
 * Chat endpoint using Vertex AI Gemini
 * Supports both direct chat and RAG-grounded responses
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
    const { query, context = [], stream = false } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    console.log(`[Chat API] Query: "${query.substring(0, 50)}..." | Context: ${context.length} docs | Stream: ${stream}`);

    // Streaming response
    if (stream) {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          try {
            if (context.length > 0) {
              // RAG mode with context
              const response = await ragClient.query(query, context);
              // For RAG, send complete response (streaming RAG is more complex)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'complete',
                answer: response.answer,
                confidence: response.confidence,
                citations: response.citations
              })}\n\n`));
            } else {
              // Direct chat mode - stream tokens
              await ragClient.chatStream(query, {
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
      // RAG mode - use query with context
      const response = await ragClient.query(query, context);

      // Apply Silence Protocol
      const confidenceThreshold = parseFloat(process.env.AEGIS_CONFIDENCE_THRESHOLD || '0.85');

      if (response.confidence < confidenceThreshold) {
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
      // Direct chat mode - no context
      const response = await ragClient.chat(query);

      return NextResponse.json({
        success: true,
        data: {
          answer: response.answer,
          confidence: 0.95, // High confidence for direct chat
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
