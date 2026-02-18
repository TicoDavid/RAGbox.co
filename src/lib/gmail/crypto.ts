import { KeyManagementServiceClient } from '@google-cloud/kms'

const kmsClient = new KeyManagementServiceClient()
const keyName = kmsClient.cryptoKeyPath(
  'ragbox-sovereign-prod',
  'us-east4',
  'ragbox-prod-keyring',
  'secrets-key'
)

/**
 * Encrypt a plaintext token using GCP KMS.
 * Returns base64-encoded ciphertext for safe DB storage.
 */
export async function encryptToken(plaintext: string): Promise<string> {
  const [result] = await kmsClient.encrypt({
    name: keyName,
    plaintext: Buffer.from(plaintext),
  })
  return Buffer.from(result.ciphertext as Uint8Array).toString('base64')
}

/**
 * Decrypt a KMS-encrypted token from base64 ciphertext.
 */
export async function decryptToken(ciphertext: string): Promise<string> {
  const [result] = await kmsClient.decrypt({
    name: keyName,
    ciphertext: Buffer.from(ciphertext, 'base64'),
  })
  return Buffer.from(result.plaintext as Uint8Array).toString('utf-8')
}

/**
 * Detect if a token is KMS-encrypted (base64 KMS ciphertext starts with 'Ci')
 * and is substantially longer than a raw Google refresh token.
 */
export function isEncrypted(token: string): boolean {
  return token.startsWith('Ci') && token.length > 200
}
