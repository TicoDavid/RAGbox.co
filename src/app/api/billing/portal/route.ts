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

let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  }
  return _stripe
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { success: false, error: 'Billing not configured' },
        { status: 503 },
      )
    }

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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, stripeCustomerId: true },
    })

    let stripeCustomerId = user?.stripeCustomerId

    // Fallback: if the user has no stripeCustomerId saved (e.g. webhook race,
    // email mismatch during checkout), search Stripe by email and backfill.
    if (!stripeCustomerId && user?.email) {
      try {
        const customers = await getStripe().customers.list({
          email: user.email,
          limit: 1,
        })
        if (customers.data.length > 0) {
          stripeCustomerId = customers.data[0].id
          // Backfill so future requests hit the fast path
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

    if (!stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: 'No active subscription. Subscribe from the pricing page to manage billing.' },
        { status: 400 },
      )
    }

    const returnUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
      : 'https://app.ragbox.co/dashboard'

    const session = await getStripe().billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: returnUrl,
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
