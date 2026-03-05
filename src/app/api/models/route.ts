import { NextRequest, NextResponse } from 'next/server'

const FEATURED_MODEL_IDS = [
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3-opus',
  'openai/gpt-4-turbo',
  'openai/gpt-4o',
  'google/gemini-pro-1.5',
  'meta-llama/llama-3.1-405b-instruct',
  'mistralai/mistral-large',
]

/**
 * GET /api/models — fetch ALL models from OpenRouter, sorted with featured first.
 * BUG-051: No truncation — returns full OpenRouter catalog.
 * Supports ?search=query for server-side filtering.
 */
export async function GET(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY
  const searchQuery = request.nextUrl.searchParams.get('search')?.toLowerCase() ?? ''

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://ragbox.co',
      'X-Title': 'RAGbox',
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const res = await fetch('https://openrouter.ai/api/v1/models', { headers })
    const data = await res.json()

    // BUG-051: Sort featured first, then alphabetical. Return ALL models.
    const sortedModels = (data.data || []).sort((a: { id: string; name: string }, b: { id: string; name: string }) => {
      const aFeatured = FEATURED_MODEL_IDS.includes(a.id)
      const bFeatured = FEATURED_MODEL_IDS.includes(b.id)
      if (aFeatured && !bFeatured) return -1
      if (!aFeatured && bFeatured) return 1
      return a.name.localeCompare(b.name)
    })

    // Strip pricing internals, keep only what the frontend needs
    let models = sortedModels.map((m: { id: string; name: string; context_length: number }) => ({
      id: m.id,
      name: m.name,
      context_length: m.context_length,
    }))

    // Server-side search if requested
    if (searchQuery) {
      models = models.filter((m: { id: string; name: string }) =>
        m.id.toLowerCase().includes(searchQuery) ||
        m.name.toLowerCase().includes(searchQuery)
      )
    }

    return NextResponse.json({ data: models, total: models.length })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 502 })
  }
}

/**
 * POST /api/models — verify a user-provided API key server-side
 *
 * Body: { apiKey: string }
 * Returns: { success, models?, error? }
 *
 * The API key never leaves the server — the browser only sees the result.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const apiKey = body?.apiKey

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      )
    }

    const res = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://ragbox.co',
        'X-Title': 'RAGbox',
      },
    })

    if (!res.ok) {
      if (res.status === 401) {
        return NextResponse.json({ success: false, error: 'Invalid API key' })
      }
      if (res.status === 403) {
        return NextResponse.json({ success: false, error: 'Access forbidden - check API key permissions' })
      }
      return NextResponse.json({ success: false, error: `API error: ${res.status}` })
    }

    const data = await res.json()

    const sortedModels = (data.data || []).sort((a: { id: string; name: string }, b: { id: string; name: string }) => {
      const aFeatured = FEATURED_MODEL_IDS.includes(a.id)
      const bFeatured = FEATURED_MODEL_IDS.includes(b.id)
      if (aFeatured && !bFeatured) return -1
      if (!aFeatured && bFeatured) return 1
      return a.name.localeCompare(b.name)
    })

    // BUG-051: Return ALL models — no truncation. Strip pricing internals only.
    const models = sortedModels.map((m: { id: string; name: string; context_length: number }) => ({
      id: m.id,
      name: m.name,
      context_length: m.context_length,
    }))

    return NextResponse.json({ success: true, models })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Network error' },
      { status: 502 }
    )
  }
}
