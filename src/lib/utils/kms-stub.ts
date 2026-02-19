/**
 * KMS Encryption Stubs — BYOLLM API Key Encryption
 *
 * Placeholder implementations using base64 encoding for local dev.
 * The real KMS wiring happens in the Go backend (STORY-023).
 *
 * See: connexus-ops/docs/kms-encryption-pattern.md for the production
 * implementation plan using Cloud KMS `secrets-key`.
 *
 * TODO(STORY-023): Replace these stubs with calls to the Go backend
 * encrypt/decrypt endpoints once KMSCrypto is wired in the Go service.
 * Production flow:
 *   encryptKey → POST /api/internal/kms/encrypt (Go backend)
 *   decryptKey → POST /api/internal/kms/decrypt (Go backend)
 */

const STUB_PREFIX = 'kms-stub:'

/**
 * Encrypt an API key for storage.
 *
 * STUB: base64 encodes with a prefix. NOT secure — dev only.
 * Production: Cloud KMS symmetric encrypt via Go backend.
 */
export async function encryptKey(plaintext: string): Promise<string> {
  // TODO(STORY-023): Replace with Go backend KMS encrypt call
  const encoded = Buffer.from(plaintext, 'utf8').toString('base64')
  return `${STUB_PREFIX}${encoded}`
}

/**
 * Decrypt a stored API key.
 *
 * STUB: base64 decodes after stripping prefix. NOT secure — dev only.
 * Production: Cloud KMS symmetric decrypt via Go backend.
 */
export async function decryptKey(ciphertext: string): Promise<string> {
  // TODO(STORY-023): Replace with Go backend KMS decrypt call
  if (!ciphertext.startsWith(STUB_PREFIX)) {
    throw new Error('Unknown encryption format — expected kms-stub: prefix')
  }
  const encoded = ciphertext.slice(STUB_PREFIX.length)
  return Buffer.from(encoded, 'base64').toString('utf8')
}

/**
 * Check if a value is encrypted (has the stub prefix).
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(STUB_PREFIX)
}
