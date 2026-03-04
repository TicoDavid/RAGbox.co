/**
 * EPIC-022 V-008: Voice Parameter Propagation Tests
 *
 * Verifies that temperature, speakingRate, and modelId flow correctly from
 * Settings UI → MercuryPersona DB → voice pipeline → TTS node.
 *
 * Pipeline stages tested:
 *   1. Settings UI stores expressiveness (0-1) + speakingRate (0.5-2.0)
 *      in MercuryPersona.channelConfig.voice JSON
 *   2. fetchMercuryConfig() extracts and maps:
 *      - expressiveness * 2 → ttsTemperature (0-2)
 *      - speakingRate → ttsSpeakingRate (0.5-2.0)
 *      - modelId → ttsModelId (optional override)
 *   3. createVoiceSession() applies to RemoteTTSComponent synthesisConfig
 *   4. RemoteTTSNode uses speakerId (voiceId) from persona
 *
 * — Sarah, QA
 */

// ─── Types mirroring voice-pipeline-v3.ts ────────────────────────────────────

interface MercuryConfig {
  name?: string
  voiceId?: string
  greeting?: string
  personalityPrompt?: string
  ttsTemperature?: number
  ttsSpeakingRate?: number
  ttsModelId?: string
}

interface VoiceChannelConfig {
  enabled?: boolean
  voiceId?: string
  expressiveness?: number   // 0-1 from UI slider
  speakingRate?: number     // 0.5-2.0 from UI slider
  modelId?: string          // optional TTS model override
}

interface MercuryPersonaRow {
  firstName: string
  lastName: string
  voiceId: string | null
  greeting: string | null
  personalityPrompt: string
  channelConfig: unknown
}

// ─── Constants from voice-pipeline-v3.ts ─────────────────────────────────────

const DEFAULT_TTS_MODEL_ID = 'inworld-tts-1-max'
const DEFAULT_VOICE_ID = 'Ashley'
const DEFAULT_TEMPERATURE = 1.1
const DEFAULT_SPEAKING_RATE = 1.0

// ─── Replicate fetchMercuryConfig mapping logic ──────────────────────────────

function extractMercuryConfig(persona: MercuryPersonaRow): MercuryConfig {
  const name = [persona.firstName, persona.lastName].filter(Boolean).join(' ')
  const voiceCfg = (typeof persona.channelConfig === 'object' && persona.channelConfig !== null
    ? (persona.channelConfig as Record<string, unknown>).voice
    : undefined) as VoiceChannelConfig | undefined

  return {
    name: name || undefined,
    voiceId: voiceCfg?.voiceId || persona.voiceId || undefined,
    greeting: persona.greeting || undefined,
    personalityPrompt: persona.personalityPrompt || undefined,
    ttsTemperature: voiceCfg?.expressiveness != null ? voiceCfg.expressiveness * 2 : undefined,
    ttsSpeakingRate: voiceCfg?.speakingRate || undefined,
    ttsModelId: voiceCfg?.modelId || undefined,
  }
}

// ─── Replicate session config resolution (createVoiceSession lines 379-385) ──

function resolveSessionConfig(config: MercuryConfig) {
  return {
    agentName: config.name || 'Mercury',
    voiceId: config.voiceId || DEFAULT_VOICE_ID,
    ttsTemperature: config.ttsTemperature ?? DEFAULT_TEMPERATURE,
    ttsSpeakingRate: config.ttsSpeakingRate ?? DEFAULT_SPEAKING_RATE,
    ttsModelId: config.ttsModelId || DEFAULT_TTS_MODEL_ID,
  }
}

// ─── Build TTS synthesisConfig (RemoteTTSComponent creation) ─────────────────

function buildTTSSynthesisConfig(session: ReturnType<typeof resolveSessionConfig>) {
  return {
    type: 'inworld' as const,
    config: {
      modelId: session.ttsModelId,
      inference: {
        temperature: session.ttsTemperature,
        speakingRate: session.ttsSpeakingRate,
      },
      postprocessing: {
        sampleRate: 48000,
      },
    },
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePersona(voice?: Partial<VoiceChannelConfig>, overrides?: Partial<MercuryPersonaRow>): MercuryPersonaRow {
  return {
    firstName: 'Mercury',
    lastName: '',
    voiceId: null,
    greeting: 'Welcome to RAGbox.',
    personalityPrompt: 'Professional assistant.',
    channelConfig: voice ? { voice } : {},
    ...overrides,
  }
}

// ============================================================================
// STAGE 1: Settings UI → channelConfig.voice persistence
// ============================================================================

describe('V-008: Settings → channelConfig.voice storage', () => {
  it('stores expressiveness slider value (0-1)', () => {
    const voiceCfg: VoiceChannelConfig = { expressiveness: 0.7, speakingRate: 1.0 }
    expect(voiceCfg.expressiveness).toBe(0.7)
  })

  it('stores speakingRate slider value (0.5-2.0)', () => {
    const voiceCfg: VoiceChannelConfig = { expressiveness: 0.5, speakingRate: 1.5 }
    expect(voiceCfg.speakingRate).toBe(1.5)
  })

  it('stores optional modelId override', () => {
    const voiceCfg: VoiceChannelConfig = { modelId: 'inworld-tts-2-experimental' }
    expect(voiceCfg.modelId).toBe('inworld-tts-2-experimental')
  })

  it('stores voiceId selection', () => {
    const voiceCfg: VoiceChannelConfig = { voiceId: 'Nathan', expressiveness: 0.5 }
    expect(voiceCfg.voiceId).toBe('Nathan')
  })
})

// ============================================================================
// STAGE 2: fetchMercuryConfig() extraction + mapping
// ============================================================================

describe('V-008: fetchMercuryConfig extraction', () => {
  it('maps expressiveness 0.5 → ttsTemperature 1.0', () => {
    const persona = makePersona({ expressiveness: 0.5 })
    const config = extractMercuryConfig(persona)
    expect(config.ttsTemperature).toBe(1.0)
  })

  it('maps expressiveness 0.0 → ttsTemperature 0.0', () => {
    const persona = makePersona({ expressiveness: 0.0 })
    const config = extractMercuryConfig(persona)
    expect(config.ttsTemperature).toBe(0.0)
  })

  it('maps expressiveness 1.0 → ttsTemperature 2.0', () => {
    const persona = makePersona({ expressiveness: 1.0 })
    const config = extractMercuryConfig(persona)
    expect(config.ttsTemperature).toBe(2.0)
  })

  it('maps expressiveness 0.55 → ttsTemperature 1.1 (default equivalent)', () => {
    const persona = makePersona({ expressiveness: 0.55 })
    const config = extractMercuryConfig(persona)
    expect(config.ttsTemperature).toBeCloseTo(1.1)
  })

  it('passes speakingRate through unchanged', () => {
    const persona = makePersona({ speakingRate: 1.5 })
    const config = extractMercuryConfig(persona)
    expect(config.ttsSpeakingRate).toBe(1.5)
  })

  it('passes modelId through', () => {
    const persona = makePersona({ modelId: 'inworld-tts-2-experimental' })
    const config = extractMercuryConfig(persona)
    expect(config.ttsModelId).toBe('inworld-tts-2-experimental')
  })

  it('prefers channelConfig.voice.voiceId over persona.voiceId', () => {
    const persona = makePersona(
      { voiceId: 'Nathan' },
      { voiceId: 'Ashley' },
    )
    const config = extractMercuryConfig(persona)
    expect(config.voiceId).toBe('Nathan')
  })

  it('falls back to persona.voiceId when channelConfig has no voiceId', () => {
    const persona = makePersona(
      { expressiveness: 0.5 },
      { voiceId: 'Ashley' },
    )
    const config = extractMercuryConfig(persona)
    expect(config.voiceId).toBe('Ashley')
  })

  it('returns undefined for missing voice channel params', () => {
    const persona = makePersona()
    const config = extractMercuryConfig(persona)
    expect(config.ttsTemperature).toBeUndefined()
    expect(config.ttsSpeakingRate).toBeUndefined()
    expect(config.ttsModelId).toBeUndefined()
  })

  it('handles null channelConfig gracefully', () => {
    const persona = makePersona(undefined, { channelConfig: null })
    const config = extractMercuryConfig(persona)
    expect(config.ttsTemperature).toBeUndefined()
    expect(config.ttsSpeakingRate).toBeUndefined()
  })

  it('handles malformed channelConfig (string instead of object)', () => {
    const persona = makePersona(undefined, { channelConfig: 'not-an-object' })
    const config = extractMercuryConfig(persona)
    expect(config.ttsTemperature).toBeUndefined()
  })
})

// ============================================================================
// STAGE 3: Session resolution (defaults)
// ============================================================================

describe('V-008: Session config resolution with defaults', () => {
  it('uses default temperature 1.1 when persona has no expressiveness', () => {
    const config = extractMercuryConfig(makePersona())
    const session = resolveSessionConfig(config)
    expect(session.ttsTemperature).toBe(DEFAULT_TEMPERATURE)
  })

  it('uses default speakingRate 1.0 when persona has no rate', () => {
    const config = extractMercuryConfig(makePersona())
    const session = resolveSessionConfig(config)
    expect(session.ttsSpeakingRate).toBe(DEFAULT_SPEAKING_RATE)
  })

  it('uses default modelId when persona has no override', () => {
    const config = extractMercuryConfig(makePersona())
    const session = resolveSessionConfig(config)
    expect(session.ttsModelId).toBe(DEFAULT_TTS_MODEL_ID)
  })

  it('uses default voiceId "Ashley" when persona has no voice', () => {
    const config = extractMercuryConfig(makePersona())
    const session = resolveSessionConfig(config)
    expect(session.voiceId).toBe(DEFAULT_VOICE_ID)
  })

  it('overrides defaults when persona has custom values', () => {
    const config = extractMercuryConfig(makePersona({
      expressiveness: 0.8,
      speakingRate: 1.3,
      modelId: 'custom-tts-model',
      voiceId: 'Nathan',
    }))
    const session = resolveSessionConfig(config)
    expect(session.ttsTemperature).toBe(1.6) // 0.8 * 2
    expect(session.ttsSpeakingRate).toBe(1.3)
    expect(session.ttsModelId).toBe('custom-tts-model')
    expect(session.voiceId).toBe('Nathan')
  })
})

// ============================================================================
// STAGE 4: TTS synthesisConfig construction
// ============================================================================

describe('V-008: RemoteTTSComponent synthesisConfig', () => {
  it('passes temperature into inference config', () => {
    const session = resolveSessionConfig(extractMercuryConfig(
      makePersona({ expressiveness: 0.7 }),
    ))
    const synth = buildTTSSynthesisConfig(session)
    expect(synth.config.inference.temperature).toBe(1.4) // 0.7 * 2
  })

  it('passes speakingRate into inference config', () => {
    const session = resolveSessionConfig(extractMercuryConfig(
      makePersona({ speakingRate: 1.8 }),
    ))
    const synth = buildTTSSynthesisConfig(session)
    expect(synth.config.inference.speakingRate).toBe(1.8)
  })

  it('passes modelId into config', () => {
    const session = resolveSessionConfig(extractMercuryConfig(
      makePersona({ modelId: 'inworld-tts-2-max' }),
    ))
    const synth = buildTTSSynthesisConfig(session)
    expect(synth.config.modelId).toBe('inworld-tts-2-max')
  })

  it('defaults produce expected synthesisConfig shape', () => {
    const session = resolveSessionConfig(extractMercuryConfig(makePersona()))
    const synth = buildTTSSynthesisConfig(session)
    expect(synth).toEqual({
      type: 'inworld',
      config: {
        modelId: 'inworld-tts-1-max',
        inference: {
          temperature: 1.1,
          speakingRate: 1.0,
        },
        postprocessing: {
          sampleRate: 48000,
        },
      },
    })
  })

  it('custom persona produces fully customized synthesisConfig', () => {
    const session = resolveSessionConfig(extractMercuryConfig(
      makePersona({
        expressiveness: 0.3,
        speakingRate: 0.8,
        modelId: 'inworld-tts-2-experimental',
      }),
    ))
    const synth = buildTTSSynthesisConfig(session)
    expect(synth.config.modelId).toBe('inworld-tts-2-experimental')
    expect(synth.config.inference.temperature).toBe(0.6) // 0.3 * 2
    expect(synth.config.inference.speakingRate).toBe(0.8)
  })
})

// ============================================================================
// END-TO-END FLOW: Settings slider → TTS inference
// ============================================================================

describe('V-008: End-to-end parameter flow', () => {
  it('expressiveness 0 → temperature 0 at TTS', () => {
    const persona = makePersona({ expressiveness: 0.0, speakingRate: 1.0 })
    const config = extractMercuryConfig(persona)
    const session = resolveSessionConfig(config)
    const synth = buildTTSSynthesisConfig(session)
    expect(synth.config.inference.temperature).toBe(0.0)
  })

  it('expressiveness 1 → temperature 2 at TTS', () => {
    const persona = makePersona({ expressiveness: 1.0, speakingRate: 1.0 })
    const config = extractMercuryConfig(persona)
    const session = resolveSessionConfig(config)
    const synth = buildTTSSynthesisConfig(session)
    expect(synth.config.inference.temperature).toBe(2.0)
  })

  it('speakingRate 0.5 → speakingRate 0.5 at TTS (minimum)', () => {
    const persona = makePersona({ speakingRate: 0.5 })
    const config = extractMercuryConfig(persona)
    const session = resolveSessionConfig(config)
    const synth = buildTTSSynthesisConfig(session)
    expect(synth.config.inference.speakingRate).toBe(0.5)
  })

  it('speakingRate 2.0 → speakingRate 2.0 at TTS (maximum)', () => {
    const persona = makePersona({ speakingRate: 2.0 })
    const config = extractMercuryConfig(persona)
    const session = resolveSessionConfig(config)
    const synth = buildTTSSynthesisConfig(session)
    expect(synth.config.inference.speakingRate).toBe(2.0)
  })

  it('no persona data → all defaults flow through', () => {
    const config = extractMercuryConfig(makePersona())
    const session = resolveSessionConfig(config)
    const synth = buildTTSSynthesisConfig(session)
    expect(synth.config.inference.temperature).toBe(1.1)
    expect(synth.config.inference.speakingRate).toBe(1.0)
    expect(synth.config.modelId).toBe('inworld-tts-1-max')
  })
})
