# Billing & Tier Enforcement — RAGbox

> Developer guide to Stripe integration, subscription tiers, provisioning, and feature gating.

---

## Overview

RAGbox uses Stripe for subscription billing. Five tiers control feature access: Free, Starter, Pro, Business, and Enterprise. Tier enforcement is checked at the API layer before executing gated operations.

---

## Subscription Tiers

| Tier | Monthly | Documents | BYOLLM | Email/SMS | API Keys | Voice |
|------|---------|-----------|--------|-----------|----------|-------|
| **Free** | $0 | 5 | No | No | 0 | No |
| **Starter** | $29 | 50 | No | No | 1 | No |
| **Pro** | $79 | 500 | Yes | Yes | 5 | Yes |
| **Business** | $199 | 5,000 | Yes | Yes | 25 | Yes |
| **Enterprise** | Custom | Unlimited | Yes | Yes | Unlimited | Yes |

### Legacy Aliases

| Legacy Tier | Maps To |
|-------------|---------|
| `basic` | `starter` |
| `premium` | `business` |

Use `normalizeTier()` from `src/lib/billing/entitlements.ts` to resolve legacy names.

---

## Tier Enforcement

Feature gates are checked via functions in `src/lib/auth/tierCheck.ts`:

### `checkVaultUpload(tier, currentDocCount)`

Returns `TierAllowed` or `TierDenied` based on document quota for the tier.

### `checkByollm(tier)`

Returns `TierDenied` for Free and Starter tiers. Pro and above allowed.

### `checkApiKeyCreation(tier, currentKeyCount)`

Checks API key quota against tier limits.

### `checkEntitlement(tier, feature)`

Generic entitlement check for any feature string.

### Response Shape

```typescript
// Allowed
{ allowed: true }

// Denied
{
  allowed: false,
  reason: string,       // User-facing message
  upgradeRequired: string  // Minimum tier needed
}
```

---

## Entitlements

`getEntitlements(tier)` returns the full feature set for a tier:

```typescript
interface Entitlements {
  maxDocuments: number
  maxApiKeys: number
  byollmEnabled: boolean
  emailEnabled: boolean
  smsEnabled: boolean
  voiceEnabled: boolean
  maxStorageGB: number
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated'
}
```

---

## Stripe Integration

### Checkout Flow

1. User selects a plan on the pricing page
2. Frontend calls `POST /api/billing/checkout` with `priceId`
3. Backend creates a Stripe Checkout Session
4. User completes payment on Stripe-hosted page
5. Stripe fires `checkout.session.completed` webhook
6. `provisionFromCheckout()` creates/updates user subscription

### Webhook Events

| Event | Handler | Action |
|-------|---------|--------|
| `checkout.session.completed` | `provisionFromCheckout()` | Create subscription, set tier |
| `customer.subscription.updated` | `updateSubscription()` | Change tier, handle downgrades |
| `invoice.payment_failed` | `handlePaymentFailed()` | Set status to `past_due` |

### Price Resolution

`resolveTierFromPriceIds(priceIds)` maps Stripe price IDs to RAGbox tiers. Each tier has associated monthly and annual price IDs configured in environment variables.

---

## Provisioning

`provisionFromCheckout()` in `src/lib/billing/provision.ts`:

1. Upsert user record with Stripe customer ID
2. Create/update tenant with tier
3. Initialize vault with tier-appropriate storage quota
4. Write audit log entry
5. Send welcome email (async, non-blocking)

---

## Testing

### Stripe Test Mode

Use Stripe test keys (`sk_test_*`) in development. Test card: `4242 4242 4242 4242`.

### Webhook Testing

Use Stripe CLI to forward webhooks locally:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

### Test Coverage

| Suite | Tests | File |
|-------|-------|------|
| Tier enforcement | 13 | `src/__tests__/billing/billing-full.test.ts` |
| Provisioning | 9 | same |
| Entitlement shapes | 7 | same |
| Price resolution | 4 | same |
| Deny response | 1 | same |
| **Total** | **34** | |

---

## Environment Variables

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Price IDs (per tier, monthly + annual)
STRIPE_PRICE_STARTER_MONTHLY=price_...
STRIPE_PRICE_STARTER_ANNUAL=price_...
STRIPE_PRICE_PRO_MONTHLY=price_...
# ... etc
```

---

*Last updated: March 4, 2026 — Sarah, Engineering, RAGbox.co*
