/**
 * Tests for the auth module (OTP helpers and authOptions configuration).
 *
 * These tests verify the OTP generation/validation logic, the NextAuth
 * configuration structure, and the callback behaviors.
 */
import { generateOTP, hasValidOTP, debugOTPStore, authOptions } from '../auth'

// ── Setup ─────────────────────────────────────────────────────

beforeEach(() => {
  // Clear the global OTP store between tests
  if (globalThis.otpStore) {
    globalThis.otpStore.clear()
  }
})

// ── OTP Generation Tests ─────────────────────────────────────

describe('generateOTP', () => {
  test('returns a 6-digit numeric string', () => {
    const code = generateOTP('user@example.com')
    expect(code).toMatch(/^\d{6}$/)
  })

  test('normalizes email to lowercase and trims whitespace', () => {
    const code = generateOTP('  User@Example.COM  ')
    expect(hasValidOTP('user@example.com')).toBe(true)
    expect(code).toMatch(/^\d{6}$/)
  })

  test('generates different codes for different emails', () => {
    const code1 = generateOTP('alice@example.com')
    const code2 = generateOTP('bob@example.com')
    // They could theoretically be the same, but the store should have both
    expect(hasValidOTP('alice@example.com')).toBe(true)
    expect(hasValidOTP('bob@example.com')).toBe(true)
  })

  test('overwrites previous OTP for the same email', () => {
    const code1 = generateOTP('user@example.com')
    const code2 = generateOTP('user@example.com')
    // The latest code should be stored
    expect(hasValidOTP('user@example.com')).toBe(true)
    // Store should only have one entry for this email
    const stored = globalThis.otpStore?.get('user@example.com')
    expect(stored?.code).toBe(code2)
  })
})

// ── OTP Validation Tests ─────────────────────────────────────

describe('hasValidOTP', () => {
  test('returns true for a freshly generated OTP', () => {
    generateOTP('user@example.com')
    expect(hasValidOTP('user@example.com')).toBe(true)
  })

  test('returns false for an email with no OTP', () => {
    expect(hasValidOTP('nobody@example.com')).toBe(false)
  })

  test('returns false for an expired OTP', () => {
    generateOTP('user@example.com')
    // Manually expire the OTP
    const stored = globalThis.otpStore?.get('user@example.com')
    if (stored) {
      stored.expires = Date.now() - 1000 // expired 1 second ago
    }
    expect(hasValidOTP('user@example.com')).toBe(false)
  })

  test('normalizes email before lookup', () => {
    generateOTP('user@example.com')
    expect(hasValidOTP('  USER@EXAMPLE.COM  ')).toBe(true)
  })
})

// ── debugOTPStore Tests ──────────────────────────────────────

describe('debugOTPStore', () => {
  const origEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = origEnv
  })

  test('logs store size in development', () => {
    process.env.NODE_ENV = 'development'
    const spy = jest.spyOn(console, 'log').mockImplementation()
    generateOTP('test@test.com')
    debugOTPStore()
    expect(spy).toHaveBeenCalledWith('[OTP Store] entry count:', expect.any(Number))
    spy.mockRestore()
  })

  test('does nothing in production', () => {
    process.env.NODE_ENV = 'production'
    const spy = jest.spyOn(console, 'log').mockImplementation()
    debugOTPStore()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

// ── authOptions Configuration Tests ──────────────────────────

describe('authOptions', () => {
  test('has JWT session strategy', () => {
    expect(authOptions.session?.strategy).toBe('jwt')
  })

  test('has 30-day session maxAge', () => {
    expect(authOptions.session?.maxAge).toBe(30 * 24 * 60 * 60)
  })

  test('configures three providers (Google, AzureAD, email-otp)', () => {
    expect(authOptions.providers).toHaveLength(3)
  })

  test('sets custom sign-in page to /', () => {
    expect(authOptions.pages?.signIn).toBe('/')
  })

  test('sets error page to /', () => {
    expect(authOptions.pages?.error).toBe('/')
  })

  test('logger.error logs to console.error', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation()
    authOptions.logger!.error('TEST_CODE', { message: 'test', stack: '' } as unknown as Error)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  test('logger.warn logs to console.warn', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation()
    authOptions.logger!.warn('TEST_WARN')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  test('has jwt, session, redirect, and signIn callbacks', () => {
    expect(authOptions.callbacks?.jwt).toBeDefined()
    expect(authOptions.callbacks?.session).toBeDefined()
    expect(authOptions.callbacks?.redirect).toBeDefined()
    expect(authOptions.callbacks?.signIn).toBeDefined()
  })
})

// ── Callback Logic Tests ─────────────────────────────────────

describe('authOptions.callbacks', () => {
  describe('redirect', () => {
    const baseUrl = 'https://ragbox.co'
    const redirect = authOptions.callbacks!.redirect!

    test('handles relative URLs by prepending baseUrl', async () => {
      const result = await redirect({ url: '/dashboard', baseUrl })
      expect(result).toBe('https://ragbox.co/dashboard')
    })

    test('allows absolute URLs on the same origin', async () => {
      const result = await redirect({
        url: 'https://ragbox.co/settings',
        baseUrl,
      })
      expect(result).toBe('https://ragbox.co/settings')
    })

    test('redirects to dashboard for external URLs', async () => {
      const result = await redirect({
        url: 'https://evil.com/phish',
        baseUrl,
      })
      expect(result).toBe('https://ragbox.co/dashboard')
    })
  })

  describe('jwt', () => {
    const jwt = authOptions.callbacks!.jwt!

    test('copies user.id to token on initial sign-in', async () => {
      const token = await jwt({
        token: { sub: '123' },
        user: { id: 'user-abc', email: 'test@test.com' },
        account: null,
        trigger: 'signIn',
      } as Parameters<typeof jwt>[0])

      expect((token as Record<string, unknown>).id).toBe('user-abc')
    })

    test('captures access_token from OAuth account', async () => {
      const token = await jwt({
        token: { sub: '123' },
        user: { id: 'user-abc' },
        account: { access_token: 'oauth-token-xyz', provider: 'google', type: 'oauth', providerAccountId: '1' },
        trigger: 'signIn',
      } as Parameters<typeof jwt>[0])

      expect((token as Record<string, unknown>).accessToken).toBe('oauth-token-xyz')
    })

    test('preserves existing token fields on subsequent calls', async () => {
      const token = await jwt({
        token: { sub: '123', id: 'user-abc', accessToken: 'existing-token' },
        trigger: 'update',
        account: null,
      } as unknown as Parameters<typeof jwt>[0])

      expect((token as Record<string, unknown>).id).toBe('user-abc')
      expect((token as Record<string, unknown>).accessToken).toBe('existing-token')
    })
  })

  describe('signIn', () => {
    const signIn = authOptions.callbacks!.signIn!

    test('always returns true (allows all sign-ins)', async () => {
      const result = await signIn({
        user: { id: '1', email: 'test@test.com' },
        account: null,
      } as Parameters<typeof signIn>[0])

      expect(result).toBe(true)
    })
  })

  describe('session', () => {
    const session = authOptions.callbacks!.session!

    test('populates session.user.id from JWT token', async () => {
      const result = await session({
        session: {
          user: { email: 'test@ragbox.co' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
        token: { sub: '123', id: 'user-abc', email: 'test@ragbox.co' },
        trigger: 'update',
      } as Parameters<typeof session>[0])

      expect((result as { user: { id: string } }).user.id).toBe('user-abc')
    })

    test('passes accessToken from JWT to session', async () => {
      const result = await session({
        session: {
          user: { email: 'test@ragbox.co' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
        user: {} as never,
        token: { sub: '123', id: 'user-abc', accessToken: 'oauth-token-xyz' },
        trigger: 'update',
      } as unknown as Parameters<typeof session>[0])

      expect((result as unknown as { accessToken: string }).accessToken).toBe('oauth-token-xyz')
    })

    test('session expires field is preserved', async () => {
      const expires = new Date(Date.now() + 86400000).toISOString()
      const result = await session({
        session: {
          user: { email: 'test@ragbox.co' },
          expires,
        },
        token: { sub: '123', id: 'user-abc' },
        trigger: 'update',
      } as Parameters<typeof session>[0])

      expect((result as { expires: string }).expires).toBe(expires)
    })
  })
})
