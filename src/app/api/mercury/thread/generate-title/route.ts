/**
 * POST /api/mercury/thread/generate-title
 *
 * Generates a short (3-5 word) thread title from the user's first query
 * using Gemini Flash. Cheap and fast — called once per new thread.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { VertexAI } from '@google-cloud/vertexai'

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'ragbox-sovereign-prod'
const LOCATION = process.env.GCP_LOCATION || 'us-east4'
const TITLE_MODEL = 'gemini-2.0-flash-001'

let vertexAI: VertexAI
function getVertex(): VertexAI {
  if (!vertexAI) {
    vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION })
  }
  return vertexAI
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { query } = (await request.json()) as { query?: string }
    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'query is required' }, { status: 400 })
    }

    const model = getVertex().getGenerativeModel({
      model: TITLE_MODEL,
      systemInstruction:
        'Generate a concise 3-5 word title summarizing the user query. ' +
        'Return ONLY the title text. No quotes, no punctuation at the end, no explanation.',
    })

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: query.slice(0, 500) }] }],
      generationConfig: {
        maxOutputTokens: 20,
        temperature: 0.3,
      },
    })

    const title = result.response?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''

    // Fallback: if LLM returns empty or too long, truncate the query
    const finalTitle = title.length > 0 && title.length <= 60
      ? title
      : query.trim().slice(0, 50)

    return NextResponse.json({ title: finalTitle })
  } catch (error) {
    console.error('[generate-title] Error:', error)
    // Non-critical — return the query as fallback
    const body = await request.clone().json().catch(() => ({ query: '' }))
    return NextResponse.json({ title: (body.query || '').slice(0, 50) })
  }
}
