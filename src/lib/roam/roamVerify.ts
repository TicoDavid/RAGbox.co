/**
 * ROAM Webhook Signature Verification
 *
 * ROAM uses the Standard Webhooks format (https://www.standardwebhooks.com/):
 *   - Header: webhook-id, webhook-timestamp, webhook-signature
 *   - Signature: HMAC-SHA256 of "{msg_id}.{timestamp}.{body}"
 *   - Secret: base64-encoded key with "whsec_" prefix
 *   - Timestamp tolerance: ±5 minutes (default)
 *
 * Steps:
 *   1. Strip "whsec_" prefix from secret
 *   2. Base64-decode to get 32-byte key
 *   3. HMAC-SHA256( key, "{webhook-id}.{webhook-timestamp}.{raw_body}" )
 *   4. Base64-encode the digest
 *   5. Compare with signature after stripping "v1," prefix
 *
 * This is NON-NEGOTIABLE — every inbound webhook MUST be verified.
 */

import { createHmac, timingSafeEqual } from 'crypto'

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

  // Decode the secret key (strip "whsec_" prefix, base64-decode to 32-byte key)
  // .trim() handles any trailing whitespace/newline from env var injection
  let keyBytes: Buffer
  try {
    const trimmed = secret.trim()
    const rawKey = trimmed.startsWith('whsec_') ? trimmed.slice(6) : trimmed
    keyBytes = Buffer.from(rawKey, 'base64')
    if (keyBytes.length === 0) {
      return { valid: false, error: 'Webhook secret decoded to empty key' }
    }
  } catch {
    return { valid: false, error: 'Invalid webhook secret format' }
  }

  // Compute expected signature: HMAC-SHA256("{msgId}.{timestamp}.{rawBody}")
  const signedContent = `${msgId}.${timestamp}.${rawBody}`
  const expectedSig = createHmac('sha256', keyBytes)
    .update(signedContent, 'utf8')
    .digest('base64')

  // The header may contain multiple signatures separated by spaces.
  // Each signature has a version prefix: "v1,<base64>"
  const signatures = signatureHeader.split(' ')
  for (const sig of signatures) {
    const commaIdx = sig.indexOf(',')
    if (commaIdx < 0) continue

    const version = sig.slice(0, commaIdx)
    const sigValue = sig.slice(commaIdx + 1)

    if (version !== 'v1') continue

    // Constant-time comparison of base64 strings directly.
    // Both expectedSig and sigValue are base64-encoded 32-byte HMAC digests.
    // Compare as UTF-8 byte buffers to use timingSafeEqual.
    try {
      const expectedBuf = Buffer.from(expectedSig, 'utf8')
      const actualBuf = Buffer.from(sigValue, 'utf8')
      if (expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf)) {
        return { valid: true }
      }
    } catch {
      continue
    }
  }

  return { valid: false, error: 'Signature verification failed' }
}
