import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'

const ValidateSchema = z.object({
  code: z.string().min(1).max(30).transform(s => s.trim().toUpperCase()),
})

/**
 * POST /api/beta/validate — Check if a beta code is valid and unused
 *
 * Pre-flight check before OAuth. Does NOT mark the code as used.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = ValidateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ valid: false, error: 'Invalid code format' }, { status: 400 })
    }

    const betaCode = await prisma.betaCode.findUnique({
      where: { code: parsed.data.code },
    })

    if (!betaCode) {
      return NextResponse.json({ valid: false, error: 'Invalid invite code' })
    }

    if (betaCode.used) {
      return NextResponse.json({ valid: false, error: 'This code has already been used' })
    }

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('[Beta Validate] Error:', error)
    return NextResponse.json({ valid: false, error: 'Internal server error' }, { status: 500 })
  }
}
