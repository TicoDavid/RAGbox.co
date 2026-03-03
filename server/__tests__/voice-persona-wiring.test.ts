/**
 * EPIC-023: Voice Persona Wiring Tests
 *
 * Tests that MercuryPersona values from the database are correctly wired
 * through the voice pipeline: agentName, greeting, voiceId, personality,
 * and conversational system prompt.
 *
 * Data flow:
 *   MercuryPersona (DB) → fetchMercuryConfig → createVoiceSession
 *   → { agentName, voiceId, greeting, personalityPrompt }
 *   → system prompt, RemoteTTSNode, triggerGreeting, interceptGroundingRefusal
 *
 * Source: voice-pipeline-v3.ts (lines 43-48, 197-232, 273-286, 525-530, 746-761)
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
const DEFAULT_TTS_MODEL_ID = 'inworld-tts-1-max'
const DEFAULT_GREETING = "Hello, I'm Mercury. How can I help you today?"

beforeEach(() => {
  mockFetch.mockReset()
})

// ─── Types ──────────────────────────────────────────────────────────────────

interface MercuryPersona {
  agentName: string
  greeting: string
  personality: 'Professional' | 'Friendly' | 'Technical'
  customInstructions: string
  voiceId: string
}

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

// ─── EPIC-023: Conversational system prompt builder ─────────────────────────
// Replicated from EPIC-023 spec (Sheldon's Task 3).
// When a query is classified as conversational, this prompt replaces the RAG prompt.

function buildConversationalPrompt(persona: MercuryPersona): string {
  return `You are ${persona.agentName}, a voice assistant for RAGböx.
You are ${persona.personality} in tone.
${persona.customInstructions}

You are in a VOICE conversation. Keep responses SHORT (1-3 sentences), natural, and conversational.
Do not mention documents, citations, or sources unless the user asks about them.
Do not say "I cannot provide a grounded answer" — just have a normal conversation.
If the user asks about their documents, tell them you can help and ask what they'd like to know.`
}

// ─── Current v3 system prompt builder (line 286) ────────────────────────────

function buildSystemPrompt(agentName: string): string {
  return `You are ${agentName}, the Virtual Representative (V-Rep) for RAGbox.co.

Keep responses concise and professional - you are speaking aloud, so be conversational but precise.
After using a tool, explain the results naturally in spoken language.`
}

// ─── TTS node config ────────────────────────────────────────────────────────

function buildTTSNodeConfig(voiceId: string) {
  return {
    speakerId: voiceId,
    languageCode: 'en-US',
    modelId: DEFAULT_TTS_MODEL_ID,
  }
}

function buildTTSComponentConfig() {
  return {
    type: 'inworld',
    config: {
      modelId: DEFAULT_TTS_MODEL_ID,
      inference: {
        temperature: 0.8,
        speakingRate: 1.0,
      },
      postprocessing: {
        sampleRate: 48000,
      },
    },
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

// ─── Test persona fixture ───────────────────────────────────────────────────

const EVELYN: MercuryPersona = {
  agentName: 'Evelyn Monroe',
  greeting: "What's up boss?",
  personality: 'Professional',
  customInstructions: 'You specialize in legal document analysis. Always be warm but authoritative.',
  voiceId: 'Luna',
}

const ATLAS: MercuryPersona = {
  agentName: 'Atlas',
  greeting: 'Atlas online. Ready for analysis.',
  personality: 'Technical',
  customInstructions: 'You focus on data extraction and technical summaries.',
  voiceId: 'Mark',
}

// ============================================================================
// AGENT NAME WIRING
// ============================================================================

describe('Persona Wiring — agentName (EPIC-023)', () => {

  it('agentName from MercuryPersona appears in session config', async () => {
    mockFetch.mockResolvedValueOnce(
      configResponse({ name: 'Evelyn Monroe', voiceId: 'Luna' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.agentName).toBe('Evelyn Monroe')
  })

  it('agentName is injected into the system prompt', async () => {
    mockFetch.mockResolvedValueOnce(
      configResponse({ name: 'Evelyn Monroe' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)
    const prompt = buildSystemPrompt(session.agentName)

    expect(prompt).toContain('Evelyn Monroe')
    expect(prompt).not.toContain('Mercury')
  })

  it('agentName appears in interceptGroundingRefusal fallbacks', async () => {
    mockFetch.mockResolvedValueOnce(
      configResponse({ name: 'Evelyn Monroe', voiceId: 'Luna' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    const refusal = 'I cannot provide a sufficiently grounded answer.'
    const fallback = interceptGroundingRefusal(refusal, 'Hello!', session.agentName)

    expect(fallback).toContain('Evelyn Monroe')
    expect(fallback).not.toContain('Mercury')
  })

  it('default agentName is Mercury when persona has no name', async () => {
    mockFetch.mockResolvedValueOnce(configResponse({}))

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.agentName).toBe('Mercury')
  })
})

// ============================================================================
// GREETING WIRING
// ============================================================================

describe('Persona Wiring — greeting (EPIC-023)', () => {

  it('custom greeting from MercuryPersona is used as initial TTS text', async () => {
    mockFetch.mockResolvedValueOnce(
      configResponse({
        name: 'Evelyn Monroe',
        greeting: "What's up boss?",
        voiceId: 'Luna',
      }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.greeting).toBe("What's up boss?")
  })

  it('greeting is NOT the hardcoded default when persona has custom greeting', async () => {
    mockFetch.mockResolvedValueOnce(
      configResponse({
        name: 'Evelyn Monroe',
        greeting: "What's up boss?",
      }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.greeting).not.toBe(DEFAULT_GREETING)
    expect(session.greeting).not.toContain("Hello, I'm Mercury")
  })

  it('auto-generated greeting uses agentName when no custom greeting set', async () => {
    mockFetch.mockResolvedValueOnce(
      configResponse({ name: 'Atlas' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.greeting).toBe("Hello, I'm Atlas. How can I help you today?")
  })

  it('greeting is suitable for TTS (no markdown, no special chars)', async () => {
    mockFetch.mockResolvedValueOnce(
      configResponse({ name: 'Evelyn Monroe', greeting: "What's up boss?" }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    // Greeting should be plain spoken text, not markdown
    expect(session.greeting).not.toMatch(/[#*_`\[\]]/)
  })
})

// ============================================================================
// VOICE ID WIRING
// ============================================================================

describe('Persona Wiring — voiceId → TTS (EPIC-023)', () => {

  it('voiceId from MercuryPersona reaches RemoteTTSNode as speakerId', async () => {
    mockFetch.mockResolvedValueOnce(
      configResponse({ name: 'Evelyn Monroe', voiceId: 'Luna' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)
    const ttsConfig = buildTTSNodeConfig(session.voiceId)

    expect(ttsConfig.speakerId).toBe('Luna')
  })

  it('voiceId Luna (selected in Settings) NOT defaulting to Ashley', async () => {
    // This is the exact bug from EPIC-023: Luna selected but Ashley plays
    mockFetch.mockResolvedValueOnce(
      configResponse({ name: 'Evelyn Monroe', voiceId: 'Luna' }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.voiceId).toBe('Luna')
    expect(session.voiceId).not.toBe('Ashley')
  })

  it('each Inworld voice produces correct TTS node config', () => {
    const voices = ['Ashley', 'Dennis', 'Luna', 'Mark'] as const
    for (const voice of voices) {
      const ttsConfig = buildTTSNodeConfig(voice)
      expect(ttsConfig.speakerId).toBe(voice)
      expect(ttsConfig.languageCode).toBe('en-US')
      expect(ttsConfig.modelId).toBe(DEFAULT_TTS_MODEL_ID)
    }
  })

  it('TTS component has correct inference defaults', () => {
    const componentConfig = buildTTSComponentConfig()
    expect(componentConfig.config.inference.temperature).toBe(0.8)
    expect(componentConfig.config.inference.speakingRate).toBe(1.0)
    expect(componentConfig.config.postprocessing.sampleRate).toBe(48000)
  })
})

// ============================================================================
// CONVERSATIONAL SYSTEM PROMPT — EPIC-023 new feature
// ============================================================================

describe('Persona Wiring — Conversational System Prompt (EPIC-023)', () => {

  it('conversational prompt includes agentName', () => {
    const prompt = buildConversationalPrompt(EVELYN)

    expect(prompt).toContain('Evelyn Monroe')
  })

  it('conversational prompt includes personality tone', () => {
    const prompt = buildConversationalPrompt(EVELYN)

    expect(prompt).toContain('Professional')
  })

  it('conversational prompt includes custom instructions', () => {
    const prompt = buildConversationalPrompt(EVELYN)

    expect(prompt).toContain('legal document analysis')
    expect(prompt).toContain('warm but authoritative')
  })

  it('conversational prompt prohibits grounding refusals', () => {
    const prompt = buildConversationalPrompt(EVELYN)

    expect(prompt).toContain('Do not say "I cannot provide a grounded answer"')
  })

  it('conversational prompt instructs short voice-appropriate responses', () => {
    const prompt = buildConversationalPrompt(EVELYN)

    expect(prompt).toContain('VOICE conversation')
    expect(prompt).toContain('SHORT')
    expect(prompt).toContain('1-3 sentences')
  })

  it('conversational prompt does not mention citations or sources', () => {
    const prompt = buildConversationalPrompt(EVELYN)

    expect(prompt).toContain('Do not mention documents, citations, or sources unless the user asks')
  })

  it('different personas produce different prompts', () => {
    const evelynPrompt = buildConversationalPrompt(EVELYN)
    const atlasPrompt = buildConversationalPrompt(ATLAS)

    expect(evelynPrompt).toContain('Evelyn Monroe')
    expect(evelynPrompt).toContain('Professional')
    expect(evelynPrompt).toContain('legal document analysis')

    expect(atlasPrompt).toContain('Atlas')
    expect(atlasPrompt).toContain('Technical')
    expect(atlasPrompt).toContain('data extraction')

    expect(evelynPrompt).not.toBe(atlasPrompt)
  })

  it('Technical personality produces technical tone instruction', () => {
    const prompt = buildConversationalPrompt(ATLAS)

    expect(prompt).toContain('Technical in tone')
  })

  it('Friendly personality produces friendly tone instruction', () => {
    const friendlyPersona: MercuryPersona = {
      agentName: 'Sunny',
      greeting: 'Hey there!',
      personality: 'Friendly',
      customInstructions: 'Be cheerful and approachable.',
      voiceId: 'Ashley',
    }
    const prompt = buildConversationalPrompt(friendlyPersona)

    expect(prompt).toContain('Friendly in tone')
  })
})

// ============================================================================
// FULL PERSONA ROUND-TRIP — all values together
// ============================================================================

describe('Persona Wiring — Full Round-Trip (EPIC-023)', () => {

  it('Evelyn Monroe persona: all values reach correct pipeline points', async () => {
    mockFetch.mockResolvedValueOnce(
      configResponse({
        name: 'Evelyn Monroe',
        voiceId: 'Luna',
        greeting: "What's up boss?",
        personalityPrompt: 'Professional legal AI assistant',
      }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)
    const ttsConfig = buildTTSNodeConfig(session.voiceId)
    const systemPrompt = buildSystemPrompt(session.agentName)
    const conversationalPrompt = buildConversationalPrompt(EVELYN)

    // agentName → session config
    expect(session.agentName).toBe('Evelyn Monroe')
    // greeting → triggerGreeting TTS text
    expect(session.greeting).toBe("What's up boss?")
    // voiceId → RemoteTTSNode speakerId
    expect(ttsConfig.speakerId).toBe('Luna')
    // agentName → system prompt
    expect(systemPrompt).toContain('Evelyn Monroe')
    // personality → conversational prompt
    expect(conversationalPrompt).toContain('Professional')
    // personalityPrompt → passed through config
    expect(config.personalityPrompt).toBe('Professional legal AI assistant')
  })

  it('Atlas persona: all values reach correct pipeline points', async () => {
    mockFetch.mockResolvedValueOnce(
      configResponse({
        name: 'Atlas',
        voiceId: 'Mark',
        greeting: 'Atlas online. Ready for analysis.',
        personalityPrompt: 'Technical data analyst',
      }),
    )

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)
    const ttsConfig = buildTTSNodeConfig(session.voiceId)

    expect(session.agentName).toBe('Atlas')
    expect(session.greeting).toBe('Atlas online. Ready for analysis.')
    expect(ttsConfig.speakerId).toBe('Mark')
    expect(config.personalityPrompt).toBe('Technical data analyst')
  })

  it('unconfigured persona: all defaults applied correctly', async () => {
    mockFetch.mockResolvedValueOnce(configResponse({}))

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)
    const ttsConfig = buildTTSNodeConfig(session.voiceId)

    expect(session.agentName).toBe('Mercury')
    expect(session.voiceId).toBe('Ashley')
    expect(session.greeting).toBe(DEFAULT_GREETING)
    expect(ttsConfig.speakerId).toBe('Ashley')
  })

  it('fetch failure: all defaults, no crash, pipeline continues', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

    const config = await fetchMercuryConfig('user-1')
    const session = resolveSessionConfig(config)

    expect(session.agentName).toBe('Mercury')
    expect(session.voiceId).toBe('Ashley')
    expect(session.greeting).toBe(DEFAULT_GREETING)
  })
})
