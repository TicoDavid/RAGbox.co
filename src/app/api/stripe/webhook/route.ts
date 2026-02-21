import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch {
    console.error('[Stripe] Webhook signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.info('[Stripe] Event:', event.type)

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      console.info('[Stripe] Checkout completed:', {
        customer: session.customer,
        subscription: session.subscription,
        email: session.customer_details?.email,
      })
      // TODO: Create user in App DB, assign entitlements, create GHL contact
      break
    }
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      console.info('[Stripe] Subscription updated:', {
        id: subscription.id,
        status: subscription.status,
      })
      // TODO: Update entitlements based on subscription items
      break
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      console.info('[Stripe] Subscription cancelled:', {
        id: subscription.id,
      })
      // TODO: Remove entitlements, trigger exit survey
      break
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      console.info('[Stripe] Payment failed:', {
        customer: invoice.customer,
        amount: invoice.amount_due,
      })
      // TODO: Update subscription_status to 'unpaid', trigger dunning
      break
    }
    default:
      console.info('[Stripe] Unhandled event:', event.type)
  }

  return NextResponse.json({ received: true })
}
