/**
 * KMS Encryption — BYOLLM API Key Encryption
 *
 * Production: Uses GCP Cloud KMS symmetric encryption (AES-256-GCM).
 * Development: Falls back to base64 stub when KMS_MODE=stub.
 *
 * Encrypted values are prefixed to identify the encryption method:
 *   "kms:"      → Cloud KMS ciphertext (production)
 *   "kms-stub:" → base64 encoding (dev only, NOT secure)
 *
 * STORY-023
 */

import { KeyManagementServiceClient } from '@google-cloud/kms'

const client = new KeyManagementServiceClient()
const PROJECT = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'ragbox-sovereign-prod'
const LOCATION = 'us-east4'
const KEYRING = 'ragbox-keys'
const KEY = 'llm-key'

const keyName = client.cryptoKeyPath(PROJECT, LOCATION, KEYRING, KEY)

const STUB_PREFIX = 'kms-stub:'
const KMS_PREFIX = 'kms:'

/**
 * Encrypt an API key for storage.
 *
 * In stub mode (KMS_MODE=stub): base64 encodes with kms-stub: prefix.
 * In production: Cloud KMS symmetric encrypt with kms: prefix.
 */
export async function encryptKey(plaintext: string): Promise<string> {
  if (process.env.KMS_MODE === 'stub') {
    const encoded = Buffer.from(plaintext, 'utf8').toString('base64')
    return `${STUB_PREFIX}${encoded}`
  }

  const [result] = await client.encrypt({
    name: keyName,
    plaintext: Buffer.from(plaintext),
  })
  return `${KMS_PREFIX}${Buffer.from(result.ciphertext as Uint8Array).toString('base64')}`
}

/**
 * Decrypt a stored API key.
 *
 * Handles both kms-stub: (dev) and kms: (production) prefixed values.
 */
export async function decryptKey(ciphertext: string): Promise<string> {
  if (ciphertext.startsWith(STUB_PREFIX)) {
    const encoded = ciphertext.slice(STUB_PREFIX.length)
    return Buffer.from(encoded, 'base64').toString('utf8')
  }

  if (!ciphertext.startsWith(KMS_PREFIX)) {
    throw new Error('Unknown encryption format')
  }

  const [result] = await client.decrypt({
    name: keyName,
    ciphertext: Buffer.from(ciphertext.slice(KMS_PREFIX.length), 'base64'),
  })
  return Buffer.from(result.plaintext as Uint8Array).toString('utf8')
}

/**
 * Check if a value is encrypted (has a recognized prefix).
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(STUB_PREFIX) || value.startsWith(KMS_PREFIX)
}
