/**
 * Onboarding API — RAGbox.co
 *
 * GET  /api/user/onboarding — Check onboarding status
 * PATCH /api/user/onboarding — Mark onboarding as completed
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompleted: true },
    })

    return NextResponse.json({
      success: true,
      onboardingCompleted: user?.onboardingCompleted ?? false,
    })
  } catch (error) {
    console.error('Onboarding GET error:', error)
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

    await prisma.user.update({
      where: { id: userId },
      data: { onboardingCompleted: true },
    })

    return NextResponse.json({ success: true, onboardingCompleted: true })
  } catch (error) {
    console.error('Onboarding PATCH error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    )
  }
}
