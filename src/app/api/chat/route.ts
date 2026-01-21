import { NextRequest, NextResponse } from 'next/server'
import { getProvider } from '@/lib/llm'

export const runtime = 'nodejs'

/**
 * POST /api/chat
 *
 * Test endpoint for the LLM provider.
 * In production, this will be replaced with the full RAG pipeline.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, context = [] } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      )
    }

    const provider = getProvider()

    // For now, use mock context if none provided
    const mockContext = context.length > 0 ? context : [
      'This is a test document. RAGbox is a sovereign RAG platform for legal and financial professionals.',
      'RAGbox uses a confidence threshold of 0.85. If confidence is below this threshold, the system refuses to answer.',
    ]

    const response = await provider.generate(query, mockContext)

    return NextResponse.json({
      success: true,
      data: {
        answer: response.text,
        model: response.model,
        usage: response.usage,
        provider: provider.name,
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)

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
