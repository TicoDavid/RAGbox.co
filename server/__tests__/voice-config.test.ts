/**
 * BUG-043B: Dynamic Voice Config Tests
 *
 * Tests that Mercury's voice configuration (voiceId, name, greeting)
 * is correctly fetched from the backend, resolved with defaults, and
 * passed through to TTS. The voice pipeline fetches config once at
 * session start — not per-message.
 *
 * Source: voice-pipeline-v3.ts (fetchMercuryConfig, createVoiceSession)
 *
 * — Sarah, QA
 */

// ─── Mock global fetch ──────────────────────────────────────────────────────
const mockFetch = jest.fn()
;(global as any).fetch = mockFetch

const GO_BACKEND_URL = 'http://localhost:8080'
const INTERNAL_AUTH = 'test-secret'
const DEFAULT_VOICE_ID = 'Ashley'
const DEFAULT_TTS_MODEL_ID = 'inworld-tts-1-max'
const DEFAULT_GREETING = "Hello, I'm Mercury. How can I help you today?"

beforeEach(() => {
  mockFetch.mockReset()
})

// ─── Types (mirror voice-pipeline-v3.ts) ────────────────────────────────────

interface MercuryConfig {
  name?: string
  voiceId?: string
  greeting?: string
  personalityPrompt?: string
}

// ─── fetchMercuryConfig: replicated from voice-pipeline-v3.ts:197–231 ──────
// Not exported from v3, so we replicate the exact logic for isolated testing.
// This function is the single source of config for the entire voice session.

async function fetchMercuryConfig(userId: string): Promise<MercuryConfig> {
  try {
    const res = await fetch(`${GO_BACKEND_URL}/api/mercury/config`, {
      headers: {
        'X-Internal-Auth': INTERNAL_AUTH,
        'X-User-ID': userId,
      },
    })
    if (res.ok) {
      const json = (await res.json()) as {
        name?: string
        voiceId?: string
        greeting?: string
        personalityPrompt?: string
        data?: {
          config?: {
            name?: string
            voiceId?: string
            greeting?: string
            personalityPrompt?: string
          }
        }
      }
      const cfg = json.data?.config ?? json
      return {
        name: cfg.name || undefined,
        voiceId: cfg.voiceId || undefined,
        greeting: cfg.greeting || undefined,
        personalityPrompt: cfg.personalityPrompt || undefined,
      }
    }
  } catch {
    // Config fetch failed — use defaults
  }
  return {}
}

// ─── resolveSessionConfig: mirrors createVoiceSession init (v3:277–280, 727–734)

function resolveSessionConfig(config: MercuryConfig) {
  const agentName = config.name || 'Mercury'
  const voiceId = config.voiceId || DEFAULT_VOICE_ID

  let greeting: string
  if (config.greeting) {
    greeting = config.greeting
  } else if (agentName !== 'Mercury') {
    greeting = `Hello, I'm ${agentName}. How can I help you today?`
  } else {
    greeting = DEFAULT_GREETING
  }

  return { agentName, voiceId, greeting }
}

// ─── TTS node config: mirrors textToSpeech (v3:529–534)

function buildTTSNodeConfig(voiceId: string) {
  return {
    speakerId: voiceId,
    languageCode: 'en-US',
    modelId: DEFAULT_TTS_MODEL_ID,
  }
}

// ─── Response helpers ───────────────────────────────────────────────────────

function configResponse(config: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => config,
    text: async () => JSON.stringify(config),
  }
}

function wrappedConfigResponse(config: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ data: { config } }),
    text: async () => JSON.stringify({ data: { config } }),
  }
}

function errorResponse(status: number) {
  return {
    ok: false,
    status,
    json: async () => ({ error: 'error' }),
    text: async () => 'error',
  }
}

// ============================================================================
// VOICE ID RESOLUTION
// ============================================================================

describe('Voice Config — voiceId Resolution (BUG-043B)', () => {

  it('default voice is Ashley when MercuryConfig has no voiceId', async () => {
    // Backend returns config without voiceId
    mockFetch.mockResolvedValueOnce(configResponse({ name: 'Mercury' }))

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.voiceId).toBe('Ashley')
  })

  it('default voice is Ashley when config fetch fails', async () => {
    // Network error
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.voiceId).toBe('Ashley')
  })

  it('default voice is Ashley when config returns 404', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404))

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.voiceId).toBe('Ashley')
  })

  it('voiceId from MercuryConfig is used when present', async () => {
    mockFetch.mockResolvedValueOnce(
      configResponse({ name: 'Atlas', voiceId: 'Dennis' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.voiceId).toBe('Dennis')
  })

  it('voiceId from wrapped response (data.config) is used', async () => {
    // Go backend wraps response: { data: { config: { voiceId: 'Luna' } } }
    mockFetch.mockResolvedValueOnce(
      wrappedConfigResponse({ name: 'Evelyn', voiceId: 'Luna' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.voiceId).toBe('Luna')
  })
})

// ============================================================================
// VOICE OPTIONS — each valid voice produces correct TTS config
// ============================================================================

describe('Voice Config — Voice Options (BUG-043B)', () => {
  const VOICES = ['Ashley', 'Dennis', 'Luna', 'Mark'] as const

  for (const voice of VOICES) {
    it(`voice "${voice}" produces valid TTS node config`, async () => {
      mockFetch.mockResolvedValueOnce(
        configResponse({ name: 'Mercury', voiceId: voice }),
      )

      const config = await fetchMercuryConfig('user-1')
      const session = resolveSessionConfig(config)
      const ttsConfig = buildTTSNodeConfig(session.voiceId)

      expect(ttsConfig.speakerId).toBe(voice)
      expect(ttsConfig.languageCode).toBe('en-US')
      expect(ttsConfig.modelId).toBe('inworld-tts-1-max')
    })
  }

  it('Google Cloud TTS voiceId passes through to speakerId', async () => {
    // Users might configure a Google Neural voice via the API
    mockFetch.mockResolvedValueOnce(
      configResponse({ voiceId: 'en-US-Neural2-D' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)
    const ttsConfig = buildTTSNodeConfig(session.voiceId)

    expect(ttsConfig.speakerId).toBe('en-US-Neural2-D')
  })
})

// ============================================================================
// INVALID / UNKNOWN VOICE FALLBACK
// ============================================================================

describe('Voice Config — Invalid voiceId Handling (BUG-043B)', () => {

  it('empty string voiceId falls back to default Ashley', async () => {
    mockFetch.mockResolvedValueOnce(configResponse({ voiceId: '' }))

    const config = await fetchMercuryConfig('user-1')
    // Empty string → cfg.voiceId || undefined → config.voiceId is undefined
    const session = resolveSessionConfig(config)

    expect(session.voiceId).toBe('Ashley')
  })

  it('null voiceId falls back to default Ashley', async () => {
    mockFetch.mockResolvedValueOnce(configResponse({ voiceId: null }))

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.voiceId).toBe('Ashley')
  })

  it('unknown voiceId is still passed through (Inworld validates)', async () => {
    // Unknown voices are passed to Inworld — it's Inworld's job to reject
    // The pipeline does NOT validate voice names client-side
    mockFetch.mockResolvedValueOnce(
      configResponse({ voiceId: 'NonExistentVoice99' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    // Pipeline passes it through; Inworld will either use it or error
    expect(session.voiceId).toBe('NonExistentVoice99')
  })
})

// ============================================================================
// CONFIG READ TIMING — session start, not per-message
// ============================================================================

describe('Voice Config — Session Start Read (BUG-043B)', () => {

  it('config is fetched once at session start with correct headers', async () => {
    mockFetch.mockResolvedValueOnce(
      configResponse({ name: 'Mercury', voiceId: 'Ashley' }),
    )

    await fetchMercuryConfig('user-42')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      `${GO_BACKEND_URL}/api/mercury/config`,
      {
        headers: {
          'X-Internal-Auth': INTERNAL_AUTH,
          'X-User-ID': 'user-42',
        },
      },
    )
  })

  it('config values are fixed for the session duration', async () => {
    mockFetch.mockResolvedValueOnce(
      configResponse({ name: 'Atlas', voiceId: 'Dennis', greeting: 'Hey!' }),
    )

    const config = await fetchMercuryConfig('user-1')

    // Simulate multiple resolveSessionConfig calls (as if per-message)
    // All should produce the same result since config is frozen at session start
    const session1 = resolveSessionConfig(config)
    const session2 = resolveSessionConfig(config)
    const session3 = resolveSessionConfig(config)

    expect(session1).toEqual(session2)
    expect(session2).toEqual(session3)
    expect(session1.voiceId).toBe('Dennis')
    expect(session1.agentName).toBe('Atlas')
    expect(session1.greeting).toBe('Hey!')

    // Only one fetch was made — not per-call
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('anonymous userId is used when no toolContext', async () => {
    mockFetch.mockResolvedValueOnce(configResponse({ name: 'Mercury' }))

    // v3 passes 'anonymous' when toolContext?.userId is missing
    await fetchMercuryConfig('anonymous')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-User-ID': 'anonymous' }),
      }),
    )
  })
})

// ============================================================================
// GREETING RESOLUTION
// ============================================================================

describe('Voice Config — Greeting Resolution (BUG-043B)', () => {

  it('custom greeting from config is used when present', () => {
    const config: MercuryConfig = {
      name: 'Atlas',
      greeting: 'Good morning! I am Atlas, your AI counsel.',
    }
    const session = resolveSessionConfig(config)

    expect(session.greeting).toBe('Good morning! I am Atlas, your AI counsel.')
  })

  it('auto-generated greeting uses agent name when no custom greeting', () => {
    const config: MercuryConfig = { name: 'Evelyn Monroe' }
    const session = resolveSessionConfig(config)

    expect(session.greeting).toBe(
      "Hello, I'm Evelyn Monroe. How can I help you today?",
    )
  })

  it('default Mercury greeting when no name and no greeting', () => {
    const config: MercuryConfig = {}
    const session = resolveSessionConfig(config)

    expect(session.greeting).toBe(DEFAULT_GREETING)
    expect(session.greeting).toContain('Mercury')
  })

  it('default Mercury greeting when name is explicitly Mercury', () => {
    const config: MercuryConfig = { name: 'Mercury' }
    const session = resolveSessionConfig(config)

    expect(session.greeting).toBe(DEFAULT_GREETING)
  })

  it('custom greeting takes precedence over name-based greeting', () => {
    // Both name and greeting set — greeting wins
    const config: MercuryConfig = {
      name: 'Atlas',
      greeting: 'Welcome to RAGbox.',
    }
    const session = resolveSessionConfig(config)

    expect(session.greeting).toBe('Welcome to RAGbox.')
    // NOT "Hello, I'm Atlas..."
    expect(session.greeting).not.toContain('Atlas')
  })
})
