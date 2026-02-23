/**
 * EPIC-012 STORY-137: KMS Stub Tests
 *
 * Verify the kms-stub encrypt/decrypt roundtrip and error handling.
 * The stub replaces GCP Cloud KMS in CI/test environments.
 *
 * — Sarah, Engineering
 */

import { encryptKey, decryptKey, isEncrypted } from '../kms-stub'

describe('KMS Stub', () => {
  it('encrypt → decrypt roundtrip returns original plaintext', async () => {
    const original = 'sk-test-api-key-1234567890'
    const encrypted = await encryptKey(original)
    const decrypted = await decryptKey(encrypted)
    expect(decrypted).toBe(original)
  })

  it('encrypted value has kms-stub: prefix', async () => {
    const encrypted = await encryptKey('my-secret')
    expect(encrypted.startsWith('kms-stub:')).toBe(true)
  })

  it('decryptKey throws on unknown encryption format', async () => {
    await expect(decryptKey('kms:invalidformat')).rejects.toThrow(
      'Unknown encryption format',
    )
  })

  it('decryptKey throws on unprefixed value', async () => {
    await expect(decryptKey('just-plain-text')).rejects.toThrow(
      'Unknown encryption format',
    )
  })

  it('isEncrypted detects kms-stub: prefix', () => {
    expect(isEncrypted('kms-stub:abc123')).toBe(true)
    expect(isEncrypted('plain-text')).toBe(false)
    expect(isEncrypted('kms:production-cipher')).toBe(false)
  })
})
