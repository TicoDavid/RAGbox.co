import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { writeAuditEntry } from '@/lib/audit/auditWriter'
import { logger } from '@/lib/logger'

const WaitlistSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email().max(320),
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(100),
  companySize: z.string().min(1).max(50),
})

/**
 * POST /api/beta/waitlist — Accept beta access applications from GHL form
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = WaitlistSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { fullName, email, company, role, companySize } = parsed.data
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null

    // Upsert: if email already exists, update their info
    await prisma.waitlistEntry.upsert({
      where: { email: email.toLowerCase() },
      create: {
        email: email.toLowerCase(),
        fullName,
        company,
        role,
        companySize,
        source: 'ghl_form',
        ipAddress: ip,
      },
      update: {
        fullName,
        company,
        role,
        companySize,
        source: 'ghl_form',
        ipAddress: ip,
      },
    })

    await writeAuditEntry('system', 'beta_waitlist_signup', email.toLowerCase(), {
      fullName,
      company,
      role,
      companySize,
    })

    return NextResponse.json(
      { success: true, message: 'Application received' },
      { status: 200 }
    )
  } catch (error) {
    logger.error('[Beta Waitlist] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
