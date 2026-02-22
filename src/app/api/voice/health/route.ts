import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const deepgramKey = process.env.DEEPGRAM_API_KEY
  const results: Record<string, { status: string; latencyMs?: number; error?: string }> = {}

  // Check Deepgram STT
  if (deepgramKey) {
    const start = Date.now()
    try {
      const res = await fetch('https://api.deepgram.com/v1/projects', {
        method: 'GET',
        headers: { Authorization: `Token ${deepgramKey}` },
        signal: AbortSignal.timeout(5000),
      })
      results.deepgram = {
        status: res.ok ? 'healthy' : 'degraded',
        latencyMs: Date.now() - start,
      }
    } catch (err) {
      results.deepgram = {
        status: 'down',
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }
  } else {
    results.deepgram = { status: 'not_configured' }
  }

  const allHealthy = Object.values(results).every(r => r.status === 'healthy')
  const anyDown = Object.values(results).some(r => r.status === 'down')

  return NextResponse.json(
    {
      overall: anyDown ? 'degraded' : allHealthy ? 'healthy' : 'partial',
      services: results,
      timestamp: new Date().toISOString(),
    },
    { status: anyDown ? 503 : 200 }
  )
}
