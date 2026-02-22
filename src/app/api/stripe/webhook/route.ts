import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { provisionFromCheckout, updateSubscription, handlePaymentFailed, sendInvoiceEmail } from '@/lib/billing/provision'

let _stripe: Stripe | null = null

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  }
  return _stripe
}

function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET)
}

/**
 * Extract price IDs from a Stripe checkout session's line items.
 */
function extractPriceIds(session: Stripe.Checkout.Session): string[] {
  const lineItems = (session as unknown as { line_items?: { data?: Array<{ price?: { id: string } }> } }).line_items
  if (!lineItems?.data) return []
  return lineItems.data
    .map((item) => item.price?.id)
    .filter((id): id is string => Boolean(id))
}

/**
 * Extract price IDs from a Stripe subscription's items.
 */
function extractSubscriptionPriceIds(subscription: Stripe.Subscription): string[] {
  return subscription.items.data
    .map((item) => item.price?.id)
    .filter((id): id is string => Boolean(id))
}

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 })
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch {
    console.error('[Stripe] Webhook signature verification failed')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.info('[Stripe] Event:', event.type)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const email = session.customer_details?.email
        const stripeCustomerId = typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id || ''
        const stripeSubscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : (session.subscription as Stripe.Subscription | null)?.id || ''

        if (!email) {
          console.error('[Stripe] No customer email in checkout session')
          break
        }

        // Retrieve session with line items to get price IDs
        let priceIds: string[] = extractPriceIds(session)
        if (priceIds.length === 0 && stripeSubscriptionId) {
          // Fetch subscription to get price IDs
          try {
            const sub = await getStripe().subscriptions.retrieve(stripeSubscriptionId)
            priceIds = extractSubscriptionPriceIds(sub)
          } catch (err) {
            console.warn('[Stripe] Could not retrieve subscription for price IDs:', err)
          }
        }

        await provisionFromCheckout({
          email,
          stripeCustomerId,
          stripeSubscriptionId,
          priceIds,
        })
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const priceIds = extractSubscriptionPriceIds(subscription)

        await updateSubscription({
          stripeSubscriptionId: subscription.id,
          status: subscription.status === 'active' ? 'active' : 'past_due',
          priceIds,
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        await updateSubscription({
          stripeSubscriptionId: subscription.id,
          status: 'cancelled',
        })
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const invoiceEmail = invoice.customer_email
        const amountPaid = invoice.amount_paid
        const invoiceUrl = invoice.hosted_invoice_url

        if (invoiceEmail) {
          sendInvoiceEmail({
            email: invoiceEmail,
            amountCents: amountPaid,
            invoiceUrl: invoiceUrl || undefined,
          }).catch((err) => console.error('[Stripe] Invoice email failed:', err))
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const stripeCustomerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id || ''

        if (stripeCustomerId) {
          await handlePaymentFailed({ stripeCustomerId })
        }
        break
      }

      default:
        console.info('[Stripe] Unhandled event:', event.type)
    }
  } catch (error) {
    console.error('[Stripe] Error processing event:', event.type, error)
    // Return 200 to prevent Stripe retries for non-transient errors
    // Transient DB errors will be caught and logged
  }

  return NextResponse.json({ received: true })
}
