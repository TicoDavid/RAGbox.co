/**
 * EPIC-011 STORY-120 Block 4: Email Send Tests
 *
 * Test welcome/invoice templates, failure handling, missing config fallback.
 *
 * — Sarah, Engineering
 */

import { welcomeSovereignEmail } from '../templates/welcome-sovereign'
import { welcomeMercuryEmail } from '../templates/welcome-mercury-addon'

// Save original env
const originalEnv = { ...process.env }

describe('Email Templates', () => {
  it('welcome sovereign email renders with correct subject and content', () => {
    const template = welcomeSovereignEmail({
      userName: 'Alice',
      mercuryName: 'Mercury',
    })

    expect(template.subject).toContain('Welcome to RAGböx Sovereign')
    expect(template.subject).toContain('Mercury')
    expect(template.html).toContain('Hi Alice')
    expect(template.html).toContain('Mercury')
    expect(template.html).toContain('Get started in 3 steps')
    expect(template.html).toContain('app.ragbox.co/dashboard')
  })

  it('welcome mercury addon email renders with voice activation info', () => {
    const template = welcomeMercuryEmail({
      userName: 'Bob',
      mercuryName: 'Atlas',
    })

    expect(template.subject).toBeDefined()
    expect(template.html).toContain('Bob')
    expect(template.html).toContain('Atlas')
  })
})

describe('Gmail Transport', () => {
  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv }
  })

  it('isGmailConfigured returns false when env vars missing', async () => {
    delete process.env.GMAIL_CLIENT_ID
    delete process.env.GMAIL_CLIENT_SECRET
    delete process.env.GMAIL_REFRESH_TOKEN

    // Re-import to pick up env changes
    jest.resetModules()
    const { isGmailConfigured } = await import('../gmail')
    expect(isGmailConfigured()).toBe(false)
  })

  it('sendViaGmail throws on token refresh failure (graceful error)', async () => {
    process.env.GMAIL_CLIENT_ID = 'test-client-id'
    process.env.GMAIL_CLIENT_SECRET = 'test-client-secret'
    process.env.GMAIL_REFRESH_TOKEN = 'test-refresh-token'

    jest.resetModules()

    // Mock global.fetch for token refresh failure
    const originalFetch = global.fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Invalid credentials'),
    }) as jest.Mock

    try {
      const { sendViaGmail } = await import('../gmail')
      await expect(
        sendViaGmail('user@test.com', 'Test', '<p>Hello</p>'),
      ).rejects.toThrow('Gmail token refresh failed')
    } finally {
      global.fetch = originalFetch
    }
  })
})
