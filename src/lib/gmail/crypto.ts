/**
 * Email Token Encryption — KMS Migration (S-P0-01)
 *
 * Phase 1 (this commit): encryptToken() uses Cloud KMS, decryptToken()
 * handles both legacy aes: and new kms-email: prefixes.
 *
 * Phase 2 (migration): batch re-encrypt existing aes: tokens via
 *   POST /api/admin/migrate-email-tokens
 *
 * Phase 3 (cleanup): remove aes: legacy path once all tokens migrated.
 *
 * Prefixes:
 *   "aes:"          → Legacy NEXTAUTH_SECRET-derived AES-256-GCM
 *   "kms-email:"    → Cloud KMS (ragbox-keys/email-token-key)
 *   "kms-stub-email:" → Dev stub (base64, NOT secure)
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { KeyManagementServiceClient } from '@google-cloud/kms'
import { logger } from '@/lib/logger'

// ============================================================================
// KMS CONFIG
// ============================================================================

const kmsClient = new KeyManagementServiceClient()
const PROJECT = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'ragbox-sovereign-prod'
const LOCATION = 'us-east4'
const KEYRING = 'ragbox-keys'
const KEY = 'email-token-key'

const kmsKeyName = kmsClient.cryptoKeyPath(PROJECT, LOCATION, KEYRING, KEY)

// ============================================================================
// PREFIXES
// ============================================================================

const LEGACY_PREFIX = 'aes:'
const KMS_PREFIX = 'kms-email:'
const STUB_PREFIX = 'kms-stub-email:'

// ============================================================================
// ENCRYPT (new path: Cloud KMS)
// ============================================================================

/**
 * Encrypt a plaintext token.
 *
 * Production: Cloud KMS symmetric encryption.
 * Development: base64 stub when KMS_MODE=stub.
 */
export async function encryptToken(plaintext: string): Promise<string> {
  if (process.env.KMS_MODE === 'stub') {
    const encoded = Buffer.from(plaintext, 'utf8').toString('base64')
    return `${STUB_PREFIX}${encoded}`
  }

  try {
    const [result] = await kmsClient.encrypt({
      name: kmsKeyName,
      plaintext: Buffer.from(plaintext),
    })
    return `${KMS_PREFIX}${Buffer.from(result.ciphertext as Uint8Array).toString('base64')}`
  } catch (error) {
    // If KMS key doesn't exist yet, fall back to legacy (transitional)
    logger.error('[Crypto] KMS encryption failed, falling back to legacy:', error)
    return encryptTokenLegacy(plaintext)
  }
}

// ============================================================================
// DECRYPT (handles both legacy aes: and new kms-email:)
// ============================================================================

/**
 * Decrypt an encrypted token.
 *
 * Handles all prefix formats:
 *   kms-email:       → Cloud KMS
 *   kms-stub-email:  → Dev stub (base64)
 *   aes:             → Legacy NEXTAUTH_SECRET-derived
 */
export async function decryptToken(ciphertext: string): Promise<string> {
  // KMS path (new)
  if (ciphertext.startsWith(KMS_PREFIX)) {
    if (process.env.KMS_MODE === 'stub') {
      throw new Error('Cannot decrypt KMS token in stub mode')
    }
    const [result] = await kmsClient.decrypt({
      name: kmsKeyName,
      ciphertext: Buffer.from(ciphertext.slice(KMS_PREFIX.length), 'base64'),
    })
    return Buffer.from(result.plaintext as Uint8Array).toString('utf8')
  }

  // Stub path (dev)
  if (ciphertext.startsWith(STUB_PREFIX)) {
    return Buffer.from(ciphertext.slice(STUB_PREFIX.length), 'base64').toString('utf8')
  }

  // Legacy path (aes: prefix)
  if (ciphertext.startsWith(LEGACY_PREFIX)) {
    return decryptTokenLegacy(ciphertext)
  }

  throw new Error('Unknown encryption format')
}

/**
 * Detect if a token is encrypted (has any recognized prefix).
 */
export function isEncrypted(token: string): boolean {
  return (
    token.startsWith(KMS_PREFIX) ||
    token.startsWith(STUB_PREFIX) ||
    token.startsWith(LEGACY_PREFIX)
  )
}

// ============================================================================
// LEGACY AES PATH (for backward compatibility during migration)
// ============================================================================

const LEGACY_ALGORITHM = 'aes-256-gcm'
const LEGACY_IV_LENGTH = 16

function getLegacyKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is required for legacy token decryption')
  }
  return createHash('sha256').update(secret.trim()).digest()
}

function encryptTokenLegacy(plaintext: string): string {
  const key = getLegacyKey()
  const iv = randomBytes(LEGACY_IV_LENGTH)
  const cipher = createCipheriv(LEGACY_ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${LEGACY_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

function decryptTokenLegacy(ciphertext: string): string {
  const parts = ciphertext.slice(LEGACY_PREFIX.length).split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid legacy encrypted token format')
  }
  const key = getLegacyKey()
  const iv = Buffer.from(parts[0], 'base64')
  const tag = Buffer.from(parts[1], 'base64')
  const encrypted = Buffer.from(parts[2], 'base64')
  const decipher = createDecipheriv(LEGACY_ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
