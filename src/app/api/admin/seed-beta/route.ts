import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let random = ''
  for (let i = 0; i < 6; i++) {
    random += chars[crypto.randomInt(chars.length)]
  }
  return `RBX-LEGAL-${random}`
}

/**
 * POST /api/admin/seed-beta — One-time seed of 50 beta invite codes
 * Protected by x-internal-auth header
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-internal-auth')
  const secret = process.env.INTERNAL_AUTH_SECRET

  if (!secret || authHeader !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if codes already seeded
  const existing = await prisma.betaCode.count()
  if (existing > 0) {
    return NextResponse.json({
      message: `Already seeded — ${existing} codes exist`,
      count: existing,
    })
  }

  const codes: { code: string; batch: number }[] = []
  const usedCodes = new Set<string>()

  for (let i = 1; i <= 50; i++) {
    let code: string
    do {
      code = generateCode()
    } while (usedCodes.has(code))
    usedCodes.add(code)

    const batch = i <= 20 ? 1 : i <= 40 ? 2 : 3
    codes.push({ code, batch })
  }

  const result = await prisma.betaCode.createMany({
    data: codes,
    skipDuplicates: true,
  })

  const batch1 = codes.filter(c => c.batch === 1).map(c => c.code)
  const batch2 = codes.filter(c => c.batch === 2).map(c => c.code)
  const batch3 = codes.filter(c => c.batch === 3).map(c => c.code)

  return NextResponse.json({
    message: `Seeded ${result.count} beta codes`,
    count: result.count,
    batch1_david: batch1,
    batch2_inbound: batch2,
    batch3_investor: batch3,
  })
}
