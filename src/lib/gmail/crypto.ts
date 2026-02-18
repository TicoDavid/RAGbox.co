import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const PREFIX = 'aes:'

function getKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('NEXTAUTH_SECRET is required for token encryption')
  }
  // Derive a 32-byte key from the secret via SHA-256
  return createHash('sha256').update(secret.trim()).digest()
}

/**
 * Encrypt a plaintext token using AES-256-GCM.
 * Returns a prefixed string: aes:<iv>:<authTag>:<ciphertext> (all base64).
 */
export async function encryptToken(plaintext: string): Promise<string> {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

/**
 * Decrypt an AES-256-GCM encrypted token.
 */
export async function decryptToken(ciphertext: string): Promise<string> {
  if (!ciphertext.startsWith(PREFIX)) {
    throw new Error('Unknown encryption format')
  }
  const parts = ciphertext.slice(PREFIX.length).split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format')
  }
  const key = getKey()
  const iv = Buffer.from(parts[0], 'base64')
  const tag = Buffer.from(parts[1], 'base64')
  const encrypted = Buffer.from(parts[2], 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

/**
 * Detect if a token is encrypted (starts with aes: prefix).
 */
export function isEncrypted(token: string): boolean {
  return token.startsWith(PREFIX)
}
