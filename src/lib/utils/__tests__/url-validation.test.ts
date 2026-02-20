import { validateExternalUrl } from '../url-validation'

describe('validateExternalUrl', () => {
  it('allows normal https URLs', () => {
    const result = validateExternalUrl('https://example.com/page')
    expect(result.ok).toBe(true)
  })

  it('allows normal http URLs', () => {
    const result = validateExternalUrl('http://example.com')
    expect(result.ok).toBe(true)
  })

  it('blocks ftp scheme', () => {
    const result = validateExternalUrl('ftp://evil.com/file')
    expect(result).toEqual({ ok: false, reason: 'Blocked protocol: ftp:' })
  })

  it('blocks file scheme', () => {
    const result = validateExternalUrl('file:///etc/passwd')
    expect(result).toEqual({ ok: false, reason: 'Blocked protocol: file:' })
  })

  it('blocks javascript scheme', () => {
    const result = validateExternalUrl('javascript:alert(1)')
    expect(result.ok).toBe(false)
  })

  it('blocks GCP metadata IP (169.254.169.254)', () => {
    const result = validateExternalUrl('http://169.254.169.254/computeMetadata/v1/')
    expect(result).toEqual({ ok: false, reason: 'Access to internal addresses is not allowed' })
  })

  it('blocks metadata.google.internal', () => {
    const result = validateExternalUrl('http://metadata.google.internal/computeMetadata/v1/')
    expect(result).toEqual({ ok: false, reason: 'Access to internal addresses is not allowed' })
  })

  it('blocks localhost', () => {
    const result = validateExternalUrl('http://localhost:8080/api/secret')
    expect(result).toEqual({ ok: false, reason: 'Access to internal addresses is not allowed' })
  })

  it('blocks 127.0.0.1 loopback', () => {
    const result = validateExternalUrl('http://127.0.0.1/')
    expect(result).toEqual({ ok: false, reason: 'Access to internal addresses is not allowed' })
  })

  it('blocks 10.x private range', () => {
    const result = validateExternalUrl('http://10.0.0.1/')
    expect(result).toEqual({ ok: false, reason: 'Access to internal addresses is not allowed' })
  })

  it('blocks 172.16.x private range', () => {
    const result = validateExternalUrl('http://172.16.0.1/')
    expect(result).toEqual({ ok: false, reason: 'Access to internal addresses is not allowed' })
  })

  it('blocks 192.168.x private range', () => {
    const result = validateExternalUrl('http://192.168.1.1/')
    expect(result).toEqual({ ok: false, reason: 'Access to internal addresses is not allowed' })
  })

  it('blocks 169.254.x link-local range', () => {
    const result = validateExternalUrl('http://169.254.1.1/')
    expect(result).toEqual({ ok: false, reason: 'Access to internal addresses is not allowed' })
  })

  it('blocks IPv6 loopback', () => {
    const result = validateExternalUrl('http://[::1]/')
    expect(result).toEqual({ ok: false, reason: 'Access to internal addresses is not allowed' })
  })

  it('rejects garbage input', () => {
    const result = validateExternalUrl('not-a-url')
    expect(result).toEqual({ ok: false, reason: 'Invalid URL format' })
  })

  it('allows 172.15.x (not in private range)', () => {
    const result = validateExternalUrl('http://172.15.0.1/')
    expect(result.ok).toBe(true)
  })

  it('allows 172.32.x (not in private range)', () => {
    const result = validateExternalUrl('http://172.32.0.1/')
    expect(result.ok).toBe(true)
  })
})
