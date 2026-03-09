/**
 * Stripe Billing Portal — RAGbox.co
 *
 * POST /api/billing/portal — creates a Stripe billing portal session
 * so customers can manage payment methods, view invoices, and cancel.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import Stripe from 'stripe'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Read secret inside handler (.trim() — Cloud Run secret gotcha)
    const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim()
    if (!stripeKey) {
      return NextResponse.json(
        { success: false, error: 'Billing not configured' },
        { status: 503 },
      )
    }

    const stripe = new Stripe(stripeKey)

    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    const userId = (token.id as string) || ''
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unable to determine user identity' },
        { status: 401 },
      )
    }

    // Check UserSubscription first, then User model fallback
    const userSub = await (prisma as any).userSubscription.findUnique({
      where: { userId },
      select: { stripeCustomerId: true },
    })

    let stripeCustomerId = userSub?.stripeCustomerId

    if (!stripeCustomerId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, stripeCustomerId: true },
      })

      stripeCustomerId = user?.stripeCustomerId ?? null

      // Fallback: search Stripe by email and backfill
      if (!stripeCustomerId && user?.email) {
        try {
          const customers = await stripe.customers.list({
            email: user.email,
            limit: 1,
          })
          if (customers.data.length > 0) {
            stripeCustomerId = customers.data[0].id
            await prisma.user.update({
              where: { id: user.id },
              data: { stripeCustomerId },
            })
            logger.info('[Billing Portal] Backfilled stripeCustomerId from Stripe lookup', {
              userId: user.id,
              stripeCustomerId,
            })
          }
        } catch (err) {
          logger.warn('[Billing Portal] Stripe customer lookup failed:', err)
        }
      }
    }

    if (!stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: 'No active subscription. Subscribe from the pricing page to manage billing.' },
        { status: 404 },
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.ragbox.co'

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/dashboard/settings?tab=billing`,
    })

    return NextResponse.json({ success: true, url: session.url })
  } catch (error) {
    logger.error('[Billing Portal] Error creating portal session:', error)
    return NextResponse.json(
      { success: false, error: 'Unable to create billing portal session' },
      { status: 500 },
    )
  }
}
