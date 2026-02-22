/**
 * KMS Encryption Stubs — TEST UTILITY ONLY
 *
 * Used by test suites to avoid GCP KMS credentials in CI.
 * Production code imports from src/lib/utils/kms.ts which
 * uses GCP Cloud KMS (AES-256-GCM) with KMS_MODE=stub fallback.
 *
 * Base64 encoding with "kms-stub:" prefix. NOT secure.
 */

const STUB_PREFIX = 'kms-stub:'

/**
 * Stub encrypt: base64 encodes with kms-stub: prefix.
 */
export async function encryptKey(plaintext: string): Promise<string> {
  const encoded = Buffer.from(plaintext, 'utf8').toString('base64')
  return `${STUB_PREFIX}${encoded}`
}

/**
 * Stub decrypt: base64 decodes after stripping prefix.
 */
export async function decryptKey(ciphertext: string): Promise<string> {
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
