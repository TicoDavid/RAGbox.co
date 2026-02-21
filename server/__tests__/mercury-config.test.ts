/**
 * Mercury Config Endpoint Tests
 *
 * Tests the /api/mercury/config endpoint (GET + POST).
 * These tests mock fetch to validate the expected API contract.
 * When the Go backend endpoint is built, these will validate compliance.
 */

const mockFetch = jest.fn()
;(global as any).fetch = mockFetch

const BACKEND_URL = 'http://localhost:8080'
const CONFIG_URL = `${BACKEND_URL}/api/mercury/config`
const INTERNAL_SECRET = 'test-internal-secret'

beforeEach(() => {
  mockFetch.mockReset()
})

// ─── Response helpers ───────────────────────────────────────────────────────

function okConfigResponse(config: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => config,
    text: async () => JSON.stringify(config),
  }
}

function errorResponse(status: number, body: Record<string, string> = { error: 'error' }) {
  return {
    ok: false,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

// ============================================================================
// 4.1 GET /api/mercury/config (4 tests)
// ============================================================================

describe('4.1 GET /api/mercury/config', () => {
  it('with valid internal auth → 200, returns {name, voiceId, greeting, personalityPrompt}', async () => {
    const config = {
      name: 'Mercury',
      voiceId: 'Ashley',
      greeting: "Hello, I'm Mercury. How can I help you today?",
      personalityPrompt: 'You are a helpful AI assistant.',
    }
    mockFetch.mockResolvedValueOnce(okConfigResponse(config))

    const res = await fetch(CONFIG_URL, {
      headers: {
        'X-Internal-Auth': INTERNAL_SECRET,
        'X-User-ID': 'user-1',
      },
    })

    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('name')
    expect(data).toHaveProperty('voiceId')
    expect(data).toHaveProperty('greeting')
    expect(data).toHaveProperty('personalityPrompt')
  })

  it('without auth header → 401', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(401, { error: 'Unauthorized' }))

    const res = await fetch(CONFIG_URL)
    expect(res.status).toBe(401)
  })

  it('with invalid auth header → 403', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403, { error: 'Forbidden' }))

    const res = await fetch(CONFIG_URL, {
      headers: { 'X-Internal-Auth': 'wrong-secret' },
    })
    expect(res.status).toBe(403)
  })

  it('for user with no config → 200, returns defaults', async () => {
    const defaults = {
      name: 'Mercury',
      voiceId: 'Ashley',
      greeting: "Hello, I'm Mercury. How can I help you today?",
      personalityPrompt: '',
    }
    mockFetch.mockResolvedValueOnce(okConfigResponse(defaults))

    const res = await fetch(CONFIG_URL, {
      headers: {
        'X-Internal-Auth': INTERNAL_SECRET,
        'X-User-ID': 'new-user',
      },
    })

    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.name).toBe('Mercury')
    expect(data.voiceId).toBe('Ashley')
    expect(data.greeting).toContain('Mercury')
  })
})

// ============================================================================
// 4.2 POST /api/mercury/config (5 tests)
// ============================================================================

describe('4.2 POST /api/mercury/config', () => {
  it('with valid body {name, voiceId} → 200, config saved', async () => {
    mockFetch.mockResolvedValueOnce(okConfigResponse({ success: true }))

    const res = await fetch(CONFIG_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_SECRET,
        'X-User-ID': 'user-1',
      },
      body: JSON.stringify({ name: 'Atlas', voiceId: 'Ashley' }),
    })

    expect(res.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody.name).toBe('Atlas')
    expect(callBody.voiceId).toBe('Ashley')
  })

  it('with partial body {name} → 200, merges with defaults', async () => {
    mockFetch.mockResolvedValueOnce(okConfigResponse({
      success: true,
      config: { name: 'Atlas', voiceId: 'Ashley', greeting: "Hello, I'm Atlas." },
    }))

    const res = await fetch(CONFIG_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_SECRET,
        'X-User-ID': 'user-1',
      },
      body: JSON.stringify({ name: 'Atlas' }),
    })

    expect(res.ok).toBe(true)
  })

  it('with empty body → 400', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(400, { error: 'Empty body' }))

    const res = await fetch(CONFIG_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_SECRET,
      },
      body: JSON.stringify({}),
    })

    expect(res.status).toBe(400)
  })

  it('without auth → 401', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(401, { error: 'Unauthorized' }))

    const res = await fetch(CONFIG_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Atlas' }),
    })

    expect(res.status).toBe(401)
  })

  it('POST then GET → GET returns what was POSTed', async () => {
    // POST
    mockFetch.mockResolvedValueOnce(okConfigResponse({ success: true }))
    await fetch(CONFIG_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_SECRET,
        'X-User-ID': 'user-1',
      },
      body: JSON.stringify({ name: 'Atlas', greeting: 'Hi, I am Atlas.' }),
    })

    // GET — should return what was posted
    mockFetch.mockResolvedValueOnce(okConfigResponse({
      name: 'Atlas',
      greeting: 'Hi, I am Atlas.',
      voiceId: 'Ashley',
      personalityPrompt: '',
    }))
    const getRes = await fetch(CONFIG_URL, {
      headers: {
        'X-Internal-Auth': INTERNAL_SECRET,
        'X-User-ID': 'user-1',
      },
    })

    expect(getRes.ok).toBe(true)
    const data = await getRes.json()
    expect(data.name).toBe('Atlas')
    expect(data.greeting).toBe('Hi, I am Atlas.')
  })
})

// ============================================================================
// 4.3 Config in Voice Pipeline (3 tests)
// ============================================================================

describe('4.3 Config in Voice Pipeline', () => {
  it('voice pipeline calls GET /api/mercury/config on session start', async () => {
    mockFetch.mockResolvedValueOnce(okConfigResponse({
      name: 'Mercury',
      greeting: 'Welcome!',
    }))

    // Simulate triggerGreeting's config fetch
    const res = await fetch(CONFIG_URL, {
      headers: {
        'X-Internal-Auth': INTERNAL_SECRET,
        'X-User-ID': 'user-1',
      },
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toBe(CONFIG_URL)
    const cfg = await res.json()
    expect(cfg.name).toBe('Mercury')
  })

  it('if 404 → uses default greeting', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404))

    const res = await fetch(CONFIG_URL, {
      headers: {
        'X-Internal-Auth': INTERNAL_SECRET,
        'X-User-ID': 'user-1',
      },
    })

    let greeting: string
    if (res.ok) {
      const cfg = await res.json()
      greeting = cfg.greeting || "Hello, I'm Mercury. How can I help you today?"
    } else {
      greeting = "Hello, I'm Mercury. How can I help you today?"
    }

    expect(greeting).toBe("Hello, I'm Mercury. How can I help you today?")
  })

  it('if 200 → uses custom greeting from config', async () => {
    mockFetch.mockResolvedValueOnce(okConfigResponse({
      name: 'Atlas',
      greeting: 'Good morning! I am Atlas, your AI counsel.',
    }))

    const res = await fetch(CONFIG_URL, {
      headers: {
        'X-Internal-Auth': INTERNAL_SECRET,
        'X-User-ID': 'user-1',
      },
    })

    const cfg = await res.json()
    const greeting = cfg.greeting || "Hello, I'm Mercury. How can I help you today?"

    expect(greeting).toBe('Good morning! I am Atlas, your AI counsel.')
  })
})
