/**
 * API Key Manager — Generation, Validation, Revocation
 *
 * Keys are SHA-256 hashed before storage. Raw keys are returned
 * ONCE at creation time and never retrievable again.
 */

import { createHash, randomBytes } from 'crypto'
import prisma from '@/lib/prisma'
import type { ApiKey } from '@prisma/client'

const KEY_PREFIX = 'rbx_live_'

/**
 * Generate a new API key.
 * Returns the raw key (shown once) and the database record.
 */
export async function generateApiKey(
  userId: string,
  name: string,
  scopes: string[] = ['read'],
): Promise<{ key: string; apiKey: ApiKey }> {
  const rawHex = randomBytes(24).toString('hex') // 48 hex chars
  const rawKey = `${KEY_PREFIX}${rawHex}`
  const keyHash = createHash('sha256').update(rawKey, 'utf8').digest('hex')
  const keyPrefix = `${KEY_PREFIX}${rawHex.slice(0, 8)}...`

  const apiKey = await prisma.apiKey.create({
    data: {
      userId,
      name,
      keyPrefix,
      keyHash,
      scopes,
    },
  })

  return { key: rawKey, apiKey }
}

/**
 * Validate an API key. Returns the key record if valid, null otherwise.
 */
export async function validateApiKey(rawKey: string): Promise<(ApiKey & { user: { id: string; email: string; name: string | null } }) | null> {
  if (!rawKey.startsWith(KEY_PREFIX)) return null

  const keyHash = createHash('sha256').update(rawKey, 'utf8').digest('hex')

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: { select: { id: true, email: true, name: true } } },
  })

  if (!apiKey) return null
  if (apiKey.isRevoked) return null
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null

  // Update last used timestamp (fire-and-forget)
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {})

  return apiKey
}

/**
 * Revoke an API key.
 */
export async function revokeApiKey(keyId: string, userId: string): Promise<boolean> {
  const result = await prisma.apiKey.updateMany({
    where: { id: keyId, userId },
    data: { isRevoked: true },
  })
  return result.count > 0
}
