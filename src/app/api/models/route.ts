import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.OPENROUTER_API_KEY

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    const res = await fetch('https://openrouter.ai/api/v1/models', { headers })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 502 })
  }
}
