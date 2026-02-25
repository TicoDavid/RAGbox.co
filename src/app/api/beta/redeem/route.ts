import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { writeAuditEntry } from '@/lib/audit/auditWriter'
import { logger } from '@/lib/logger'

const RedeemSchema = z.object({
  code: z.string().min(1).max(30).transform(s => s.trim().toUpperCase()),
})

/**
 * POST /api/beta/redeem — Mark a beta code as used after OAuth success
 *
 * Requires authenticated session. Called from dashboard on first load.
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getToken({ req: request })
    if (!token?.email) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = RedeemSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid code format' }, { status: 400 })
    }

    const { code } = parsed.data
    const email = (token.email as string).toLowerCase()

    const betaCode = await prisma.betaCode.findUnique({
      where: { code },
    })

    if (!betaCode) {
      return NextResponse.json({ success: false, error: 'Invalid invite code' }, { status: 400 })
    }

    // Already redeemed by this user — idempotent success
    if (betaCode.used && betaCode.usedBy === email) {
      return NextResponse.json({ success: true, alreadyRedeemed: true })
    }

    // Used by someone else
    if (betaCode.used) {
      return NextResponse.json({ success: false, error: 'Code already used' }, { status: 400 })
    }

    await prisma.betaCode.update({
      where: { code },
      data: {
        used: true,
        usedBy: email,
        usedAt: new Date(),
      },
    })

    await writeAuditEntry('system', 'beta_code_redeemed', code, {
      email,
      batch: betaCode.batch,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('[Beta Redeem] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
