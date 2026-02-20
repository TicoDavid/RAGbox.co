/**
 * SSRF Protection — shared URL validation for external fetches.
 *
 * Blocks private IPs, link-local, GCP metadata, and non-HTTP schemes.
 * Used by /api/chat (safety-mode) and /api/scrape.
 */

const PRIVATE_IP_PATTERNS = [
  /^127\./,                          // Loopback
  /^10\./,                           // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[01])\./,  // 172.16.0.0/12
  /^192\.168\./,                     // 192.168.0.0/16
  /^169\.254\./,                     // Link-local (includes GCP metadata 169.254.169.254)
  /^0\./,                            // Current network
  /^fc00:/i,                         // IPv6 unique local
  /^fe80:/i,                         // IPv6 link-local
  /^::1$/,                           // IPv6 loopback
  /^::$/,                            // IPv6 unspecified
]

const BLOCKED_HOSTS = ['localhost', 'metadata.google.internal', '[::1]']

export type UrlValidationResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string }

/**
 * Validate a URL for safe external fetching.
 * Returns `{ ok: true, url }` or `{ ok: false, reason }`.
 */
export function validateExternalUrl(raw: string): UrlValidationResult {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { ok: false, reason: 'Invalid URL format' }
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, reason: `Blocked protocol: ${parsed.protocol}` }
  }

  const hostname = parsed.hostname.toLowerCase()

  if (BLOCKED_HOSTS.includes(hostname)) {
    return { ok: false, reason: 'Access to internal addresses is not allowed' }
  }

  if (PRIVATE_IP_PATTERNS.some(p => p.test(hostname))) {
    return { ok: false, reason: 'Access to internal addresses is not allowed' }
  }

  return { ok: true, url: parsed }
}
