import { NextRequest, NextResponse } from 'next/server';
import { ragClient } from '@/lib/vertex/rag-client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * POST /api/chat
 * 
 * RAG-powered chat endpoint using Vertex AI
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
    const { query, context = [] } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    // Use provided context or fallback to demo context
    const documentContext = context.length > 0 ? context : [
      'RAGbox is a sovereign document intelligence platform for compliance-sensitive professionals.',
      'The platform uses a confidence threshold of 85%. Below this threshold, the Silence Protocol activates.',
      'AEGIS (Automated Enterprise Guard for Information Security) provides privilege-based access control.',
      'All queries and responses are logged in the Veritas immutable audit trail for SEC 17a-4 compliance.',
    ];

    // Query using Vertex AI
    const response = await ragClient.query(query, documentContext);

    // Apply Silence Protocol - refuse to answer if confidence is too low
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
  } catch (error) {
    console.error('Chat API error:', error);

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