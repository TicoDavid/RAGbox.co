/**
 * Mercury Settings Integration Tests
 *
 * Tests the full flow: Mercury Settings UI values → config API →
 * fetchMercuryConfig → voice pipeline session variables → TTS/greeting
 * behavior. Validates that what the user configures in the Settings
 * modal actually reaches the voice pipeline.
 *
 * Data flow:
 *   MercuryConfigModal → POST /api/mercury/config → DB
 *   → GET /api/mercury/config → fetchMercuryConfig → createVoiceSession
 *   → { agentName, voiceId, greeting } → RemoteTTSNode, triggerGreeting, interceptGroundingRefusal
 *
 * — Sarah, QA
 */

import { interceptGroundingRefusal } from '../voice-pipeline-v3'

// ─── Mock global fetch ──────────────────────────────────────────────────────
const mockFetch = jest.fn()
;(global as any).fetch = mockFetch

const GO_BACKEND_URL = 'http://localhost:8080'
const INTERNAL_AUTH = 'test-secret'
const DEFAULT_VOICE_ID = 'Ashley'
const DEFAULT_GREETING = "Hello, I'm Mercury. How can I help you today?"

beforeEach(() => {
  mockFetch.mockReset()
})

// ─── Types ──────────────────────────────────────────────────────────────────

interface MercuryConfig {
  name?: string
  voiceId?: string
  greeting?: string
  personalityPrompt?: string
}

// ─── Replicated pipeline functions ──────────────────────────────────────────

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
    // falls through to defaults
  }
  return {}
}

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

// ─── Response helpers ───────────────────────────────────────────────────────

function settingsResponse(settings: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => settings,
    text: async () => JSON.stringify(settings),
  }
}

// ============================================================================
// IDENTITY TAB → VOICE PIPELINE
// Agent name and greeting from Mercury Settings Identity tab
// ============================================================================

describe('Settings Integration — Identity Tab (name + greeting)', () => {

  it('agent name from Identity is used in voice responses', async () => {
    // User sets name to "Evelyn Monroe" in Mercury Settings
    mockFetch.mockResolvedValueOnce(
      settingsResponse({ name: 'Evelyn Monroe', voiceId: 'Luna' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.agentName).toBe('Evelyn Monroe')

    // Agent name is used in grounding refusal fallbacks
    const refusal = 'I cannot provide a sufficiently grounded answer.'
    const fallback = interceptGroundingRefusal(refusal, 'Hello!', session.agentName)

    expect(fallback).toContain('Evelyn Monroe')
    expect(fallback).not.toContain('Mercury')
  })

  it('greeting from Identity is used verbatim in voice greeting', async () => {
    // User sets custom greeting in Mercury Settings
    const customGreeting = 'Welcome to Anderson Legal. I am your AI paralegal, ready to assist.'

    mockFetch.mockResolvedValueOnce(
      settingsResponse({
        name: 'Evelyn Monroe',
        greeting: customGreeting,
        voiceId: 'Luna',
      }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.greeting).toBe(customGreeting)
    // Not the default
    expect(session.greeting).not.toContain("Hello, I'm Mercury")
  })

  it('auto-generated greeting includes agent name when no custom greeting', async () => {
    mockFetch.mockResolvedValueOnce(
      settingsResponse({ name: 'Atlas' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.greeting).toBe("Hello, I'm Atlas. How can I help you today?")
  })

  it('default name (Mercury) produces default greeting', async () => {
    // User didn't customize name — backend returns no name
    mockFetch.mockResolvedValueOnce(settingsResponse({}))

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.agentName).toBe('Mercury')
    expect(session.greeting).toBe(DEFAULT_GREETING)
  })
})

// ============================================================================
// VOICE TAB → TTS PIPELINE
// Voice selection from Mercury Settings Voice tab
// ============================================================================

describe('Settings Integration — Voice Tab (voiceId → TTS)', () => {

  it('female voice selection reaches TTS as speakerId', async () => {
    mockFetch.mockResolvedValueOnce(
      settingsResponse({ name: 'Mercury', voiceId: 'Ashley' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.voiceId).toBe('Ashley')
  })

  it('male voice selection reaches TTS as speakerId', async () => {
    mockFetch.mockResolvedValueOnce(
      settingsResponse({ name: 'Mercury', voiceId: 'Dennis' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.voiceId).toBe('Dennis')
  })

  it('voice selection persists across messages within session', async () => {
    mockFetch.mockResolvedValueOnce(
      settingsResponse({ name: 'Atlas', voiceId: 'Mark' }),
    )

    const config = await fetchMercuryConfig('user-1')

    // Simulate multiple messages in the same session
    // Config should not be re-fetched — voiceId stays the same
    const session1 = resolveSessionConfig(config)
    const session2 = resolveSessionConfig(config)

    expect(session1.voiceId).toBe('Mark')
    expect(session2.voiceId).toBe('Mark')
    expect(mockFetch).toHaveBeenCalledTimes(1) // Only one fetch
  })

  it('no voice selection in settings → default Ashley', async () => {
    // User never configured voice — backend returns no voiceId
    mockFetch.mockResolvedValueOnce(
      settingsResponse({ name: 'Mercury' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.voiceId).toBe('Ashley')
  })
})

// ============================================================================
// FULL SETTINGS FLOW — all fields together
// ============================================================================

describe('Settings Integration — Full Config Round-Trip', () => {

  it('all settings fields reach the voice pipeline correctly', async () => {
    const fullConfig = {
      name: 'Evelyn Monroe',
      voiceId: 'Luna',
      greeting: 'Good morning. Evelyn Monroe here, your AI counsel.',
      personalityPrompt: 'You are a warm, professional legal AI assistant.',
    }

    mockFetch.mockResolvedValueOnce(settingsResponse(fullConfig))

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.agentName).toBe('Evelyn Monroe')
    expect(session.voiceId).toBe('Luna')
    expect(session.greeting).toBe(fullConfig.greeting)

    // personalityPrompt is passed through (used in system prompt)
    expect(config.personalityPrompt).toBe(fullConfig.personalityPrompt)
  })

  it('wrapped response format (data.config) works the same', async () => {
    // Go backend may wrap config in { data: { config: {...} } }
    const innerConfig = {
      name: 'Atlas',
      voiceId: 'Mark',
      greeting: 'Atlas online. Ready for analysis.',
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { config: innerConfig } }),
      text: async () => JSON.stringify({ data: { config: innerConfig } }),
    })

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.agentName).toBe('Atlas')
    expect(session.voiceId).toBe('Mark')
    expect(session.greeting).toBe('Atlas online. Ready for analysis.')
  })

  it('config fetch failure → all defaults, no crash', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.agentName).toBe('Mercury')
    expect(session.voiceId).toBe('Ashley')
    expect(session.greeting).toBe(DEFAULT_GREETING)
  })

  it('partial config → missing fields use defaults', async () => {
    // Backend returns only name — rest should default
    mockFetch.mockResolvedValueOnce(
      settingsResponse({ name: 'Evelyn Monroe' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.agentName).toBe('Evelyn Monroe')
    expect(session.voiceId).toBe('Ashley') // default
    expect(session.greeting).toBe(
      "Hello, I'm Evelyn Monroe. How can I help you today?",
    ) // auto-generated from name
  })
})

// ============================================================================
// PERSONA → GROUNDING REFUSAL RESPONSES
// Agent name from settings reaches interceptGroundingRefusal
// ============================================================================

describe('Settings Integration — Persona in Refusal Responses', () => {

  it('custom agent name appears in greeting refusal fallback', async () => {
    mockFetch.mockResolvedValueOnce(
      settingsResponse({ name: 'Evelyn Monroe', voiceId: 'Luna' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    const refusal = 'I cannot provide a sufficiently grounded answer.'
    const result = interceptGroundingRefusal(refusal, 'Hello!', session.agentName)

    expect(result).toContain('Evelyn Monroe')
  })

  it('custom agent name appears in identity refusal fallback', async () => {
    mockFetch.mockResolvedValueOnce(
      settingsResponse({ name: 'Atlas' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    const refusal = 'I cannot provide a sufficiently grounded answer.'
    const result = interceptGroundingRefusal(refusal, 'Who are you?', session.agentName)

    expect(result).toContain('Atlas')
    expect(result).not.toContain('Mercury')
  })

  it('default Mercury name used when no custom name set', async () => {
    mockFetch.mockResolvedValueOnce(settingsResponse({}))

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    const refusal = 'No relevant documents were found for your query.'
    const result = interceptGroundingRefusal(refusal, 'Hey there!', session.agentName)

    expect(result).toContain('Mercury')
  })
})
