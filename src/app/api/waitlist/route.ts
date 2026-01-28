/**
 * Waitlist API - RAGbox.co
 *
 * POST /api/waitlist - Add email to Pioneer waitlist
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const waitlistSchema = z.object({
  email: z.string().email('Invalid email address'),
  source: z.string().optional(),
})

/**
 * Extract client IP for tracking
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0] || 'unknown'
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()

    // Validate input
    const result = waitlistSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }

    const { email, source } = result.data
    const ipAddress = getClientIP(request)
    const referrer = request.headers.get('referer') || undefined

    // Check if already on waitlist
    const existing = await prisma.waitlistEntry.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existing) {
      return NextResponse.json({
        success: true,
        message: 'You are already on the waitlist!',
        alreadyExists: true,
      })
    }

    // Add to waitlist
    await prisma.waitlistEntry.create({
      data: {
        email: email.toLowerCase(),
        source: source || 'landing',
        referrer,
        ipAddress,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Welcome to the Pioneer list! Check your email.',
      alreadyExists: false,
    })
  } catch (error) {
    console.error('[Waitlist API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to join waitlist. Please try again.' },
      { status: 500 }
    )
  }
}
