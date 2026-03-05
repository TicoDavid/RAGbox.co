/**
 * Mercury User Profile API (E24-003)
 *
 * GET  — Load user profile for context injection
 * PUT  — Update user profile preferences
 *
 * Uses raw SQL for new fields until Prisma client is regenerated.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  try {
    const profiles = await prisma.$queryRawUnsafe<Array<{
      id: string
      display_name: string | null
      role: string | null
      company: string | null
      priorities: unknown
      preferences: unknown
      timezone: string | null
      last_updated: Date
    }>>(
      `SELECT id, display_name, role, company, priorities, preferences, timezone, last_updated
       FROM mercury_user_profiles
       WHERE user_id = $1
       LIMIT 1`,
      userId
    )

    if (profiles.length === 0) {
      // Auto-create from User record
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, companyName: true, jobTitle: true },
      })

      if (user) {
        const id = `mup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        await prisma.$executeRawUnsafe(
          `INSERT INTO mercury_user_profiles (id, user_id, display_name, role, company, last_updated)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (user_id) DO NOTHING`,
          id, userId, user.name, user.jobTitle, user.companyName
        )

        return NextResponse.json({
          success: true,
          data: {
            displayName: user.name,
            role: user.jobTitle,
            company: user.companyName,
            priorities: null,
            preferences: null,
            timezone: null,
          },
        })
      }

      return NextResponse.json({ success: true, data: null })
    }

    const p = profiles[0]
    return NextResponse.json({
      success: true,
      data: {
        displayName: p.display_name,
        role: p.role,
        company: p.company,
        priorities: p.priorities,
        preferences: p.preferences,
        timezone: p.timezone,
        lastUpdated: p.last_updated,
      },
    })
  } catch (err) {
    logger.error('[Mercury Profile] GET error:', err)
    return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { displayName, role, company, priorities, preferences, timezone } = body

    const id = `mup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    await prisma.$executeRawUnsafe(
      `INSERT INTO mercury_user_profiles (id, user_id, display_name, role, company, priorities, preferences, timezone, last_updated)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         display_name = COALESCE(EXCLUDED.display_name, mercury_user_profiles.display_name),
         role = COALESCE(EXCLUDED.role, mercury_user_profiles.role),
         company = COALESCE(EXCLUDED.company, mercury_user_profiles.company),
         priorities = COALESCE(EXCLUDED.priorities, mercury_user_profiles.priorities),
         preferences = COALESCE(EXCLUDED.preferences, mercury_user_profiles.preferences),
         timezone = COALESCE(EXCLUDED.timezone, mercury_user_profiles.timezone),
         last_updated = NOW()`,
      id, userId,
      displayName ?? null,
      role ?? null,
      company ?? null,
      priorities ? JSON.stringify(priorities) : null,
      preferences ? JSON.stringify(preferences) : null,
      timezone ?? null
    )

    logger.info('[Mercury Profile] Updated', { userId })

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.error('[Mercury Profile] PUT error:', err)
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 })
  }
}
