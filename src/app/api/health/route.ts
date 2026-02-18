import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const checks: Record<string, 'ok' | 'error'> = {}
  let healthy = true

  // DB connectivity
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'ok'
  } catch {
    checks.database = 'error'
    healthy = false
  }

  // Go backend connectivity
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.RAGBOX_BACKEND_URL
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/api/health`, { signal: AbortSignal.timeout(5000) })
      checks.backend = res.ok ? 'ok' : 'error'
    } catch {
      checks.backend = 'error'
      healthy = false
    }
  } else {
    checks.backend = 'error'
    healthy = false
  }

  return NextResponse.json(
    { status: healthy ? 'healthy' : 'degraded', checks },
    { status: healthy ? 200 : 503 }
  )
}
