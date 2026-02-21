import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const startedAt = Date.now()

export async function GET(): Promise<NextResponse> {
  const checks: Record<string, string> = {}
  const latency: Record<string, number> = {}
  let healthy = true

  // DB connectivity
  const dbStart = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch {
    checks.database = 'error'
    healthy = false
  }
  latency.database = Date.now() - dbStart

  // Go backend connectivity
  const backendUrl = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL
  let backendVersion = 'unknown'
  if (backendUrl) {
    const backendStart = Date.now()
    try {
      const res = await fetch(`${backendUrl}/api/health`, { signal: AbortSignal.timeout(5000) })
      checks.backend = res.ok ? 'ok' : 'error'
      if (res.ok) {
        const data = await res.json()
        backendVersion = data.version || 'unknown'
      }
      if (!res.ok) healthy = false
    } catch {
      checks.backend = 'error'
      healthy = false
    }
    latency.backend = Date.now() - backendStart
  } else {
    checks.backend = 'error'
    healthy = false
  }

  return NextResponse.json(
    {
      status: healthy ? 'healthy' : 'degraded',
      checks,
      latency,
      backendVersion,
      uptimeS: Math.floor((Date.now() - startedAt) / 1000),
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  )
}
