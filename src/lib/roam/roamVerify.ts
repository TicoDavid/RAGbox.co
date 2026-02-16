/**
 * ROAM Webhook Signature Verification
 *
 * ROAM uses the Standard Webhooks format (https://www.standardwebhooks.com/):
 *   - Header: webhook-id, webhook-timestamp, webhook-signature
 *   - Signature: HMAC-SHA256 of "{msg_id}.{timestamp}.{body}"
 *   - Secret: base64-encoded key with "whsec_" prefix
 *   - Timestamp tolerance: ±5 minutes (default)
 *
 * This is NON-NEGOTIABLE — every inbound webhook MUST be verified.
 */

import crypto from 'crypto'

const TIMESTAMP_TOLERANCE_SECONDS = 300 // 5 minutes

export interface WebhookHeaders {
  'webhook-id': string
  'webhook-timestamp': string
  'webhook-signature': string
}

export interface VerifyResult {
  valid: boolean
  error?: string
}

/**
 * Verify a ROAM webhook signature using Standard Webhooks format.
 *
 * @param rawBody  The raw request body as a string (NOT parsed JSON)
 * @param headers  The three webhook-* headers
 * @param secret   The webhook secret (with whsec_ prefix)
 */
export function verifyWebhookSignature(
  rawBody: string,
  headers: WebhookHeaders,
  secret: string
): VerifyResult {
  const msgId = headers['webhook-id']
  const timestamp = headers['webhook-timestamp']
  const signatureHeader = headers['webhook-signature']

  // Validate required headers
  if (!msgId || !timestamp || !signatureHeader) {
    return { valid: false, error: 'Missing required webhook headers' }
  }

  // Validate timestamp is within tolerance (anti-replay)
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts)) {
    return { valid: false, error: 'Invalid webhook timestamp' }
  }

  const now = Math.floor(Date.now() / 1000)
  const diff = Math.abs(now - ts)
  if (diff > TIMESTAMP_TOLERANCE_SECONDS) {
    return { valid: false, error: `Webhook timestamp too old (${diff}s drift)` }
  }

  // Decode the secret key (strip "whsec_" prefix, base64 decode)
  let keyBytes: Buffer
  try {
    const rawKey = secret.startsWith('whsec_') ? secret.slice(6) : secret
    keyBytes = Buffer.from(rawKey, 'base64')
  } catch {
    return { valid: false, error: 'Invalid webhook secret format' }
  }

  // Compute expected signature
  const signedContent = `${msgId}.${timestamp}.${rawBody}`
  const expectedSig = crypto
    .createHmac('sha256', keyBytes)
    .update(signedContent)
    .digest('base64')

  // The header may contain multiple signatures separated by spaces
  // Each signature has a version prefix: "v1,<base64>"
  const signatures = signatureHeader.split(' ')
  for (const sig of signatures) {
    const parts = sig.split(',')
    if (parts.length < 2) continue
    // Currently only v1 is supported
    const version = parts[0]
    const sigValue = parts.slice(1).join(',') // handle base64 = padding

    if (version === 'v1') {
      // Constant-time comparison
      try {
        const expected = Buffer.from(expectedSig, 'base64')
        const actual = Buffer.from(sigValue, 'base64')
        if (expected.length === actual.length && crypto.timingSafeEqual(expected, actual)) {
          return { valid: true }
        }
      } catch {
        // Bad base64 — try next signature
        continue
      }
    }
  }

  return { valid: false, error: 'Signature verification failed' }
}
