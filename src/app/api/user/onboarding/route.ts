/**
 * Onboarding API — RAGbox.co
 *
 * GET  /api/user/onboarding — Check onboarding status
 * PATCH /api/user/onboarding — Mark onboarding as completed
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    const userId = (token.id as string) || token.email || ''
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unable to determine user identity' },
        { status: 401 },
      )
    }

    let onboardingCompleted = false
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { onboardingCompleted: true },
      })
      onboardingCompleted = user?.onboardingCompleted ?? false
    } catch (dbError: unknown) {
      // BUG-039b: If onboarding_completed column doesn't exist yet (P2022),
      // return false — user can still proceed through onboarding flow.
      const prismaCode = (dbError as { code?: string })?.code
      if (prismaCode === 'P2022') {
        logger.warn('Onboarding GET: P2022 — column missing, returning default false')
      } else {
        throw dbError // re-throw non-P2022 errors to outer catch
      }
    }

    return NextResponse.json({
      success: true,
      onboardingCompleted,
    })
  } catch (error) {
    logger.error('Onboarding GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    const userId = (token.id as string) || token.email || ''
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unable to determine user identity' },
        { status: 401 },
      )
    }

    const body = await request.json()
    if (body.completed !== true) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 },
      )
    }

    try {
      await prisma.user.update({
        where: { id: userId },
        data: { onboardingCompleted: true },
      })
    } catch (dbError: unknown) {
      // BUG-039b: If onboarding_completed column doesn't exist yet (P2022),
      // acknowledge the request — the column will be created on next prisma db push.
      const prismaCode = (dbError as { code?: string })?.code
      if (prismaCode === 'P2022') {
        logger.warn('Onboarding PATCH: P2022 — column missing, acknowledging request')
      } else {
        throw dbError
      }
    }

    return NextResponse.json({ success: true, onboardingCompleted: true })
  } catch (error) {
    logger.error('Onboarding PATCH error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
