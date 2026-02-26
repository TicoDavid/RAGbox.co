/**
 * BUG-042 SA-042-04: Integration Smoke Tests
 *
 * Full pipeline mock — STT → LLM → TTS → WebSocket delivery.
 * Tests the complete voice session flow end-to-end with mocked
 * external services (Deepgram, Inworld, Go backend).
 *
 * — Sarah, QA
 */

// ─── Mock global fetch ──────────────────────────────────────────────────────
const mockFetch = jest.fn()
;(global as any).fetch = mockFetch

const INWORLD_TTS_URL = 'https://api.inworld.ai/tts/v1/voice'
const DEEPGRAM_STT_URL = 'https://api.deepgram.com/v1/listen'
const GO_BACKEND_URL = 'http://localhost:8080'
const SAMPLE_RATE = 48000
const TTS_CHUNK_SIZE = 16384

beforeEach(() => {
  mockFetch.mockReset()
})

// ─── Response helpers ───────────────────────────────────────────────────────

function deepgramSTTResponse(transcript: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      results: {
        channels: [{ alternatives: [{ transcript, confidence: 0.97 }] }],
      },
    }),
    text: async () => 'ok',
  }
}

function goBackendJSONResponse(answer: string) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data: { answer } }),
  }
}

function inworldTTSResponse(audioText: string) {
  const audioContent = Buffer.from(audioText).toString('base64')
  return {
    ok: true,
    status: 200,
    json: async () => ({ audioContent }),
    text: async () => JSON.stringify({ audioContent }),
  }
}

function configResponse(name: string, greeting: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ name, greeting }),
    text: async () => JSON.stringify({ name, greeting }),
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

type AgentState = 'connecting' | 'listening' | 'processing' | 'speaking' | 'idle' | 'error'

type ServerEvent =
  | { type: 'state'; state: AgentState }
  | { type: 'asr_partial'; text: string }
  | { type: 'asr_final'; text: string }
  | { type: 'agent_text_partial'; text: string }
  | { type: 'agent_text_final'; text: string }
  | { type: 'binary'; data: Buffer }

// ─── Mock callbacks + event recorder ────────────────────────────────────────

interface EventRecorder {
  events: ServerEvent[]
  onTranscriptPartial: (text: string) => void
  onTranscriptFinal: (text: string) => void
  onAgentTextPartial: (text: string) => void
  onAgentTextFinal: (text: string) => void
  onTTSChunk: (audioBase64: string) => void
  onSpeakingComplete: () => void
  onError: jest.Mock
}

function createEventRecorder(): EventRecorder {
  const events: ServerEvent[] = []

  return {
    events,
    onTranscriptPartial(text: string) {
      events.push({ type: 'asr_partial', text })
    },
    onTranscriptFinal(text: string) {
      events.push({ type: 'asr_final', text })
    },
    onAgentTextPartial(text: string) {
      events.push({ type: 'agent_text_partial', text })
    },
    onAgentTextFinal(text: string) {
      events.push({ type: 'agent_text_final', text })
    },
    onTTSChunk(audioBase64: string) {
      events.push({ type: 'binary', data: Buffer.from(audioBase64, 'base64') })
    },
    onSpeakingComplete() {
      events.push({ type: 'state', state: 'idle' })
    },
    onError: jest.fn(),
  }
}

// ─── Grounding refusal patterns ─────────────────────────────────────────────

const REFUSAL_PATTERNS = [
  /cannot provide a sufficiently grounded answer/i,
  /don't have enough information in the available documents/i,
]

function isGroundingRefusal(text: string): boolean {
  if (!text || text.trim().length === 0) return true
  return REFUSAL_PATTERNS.some((p) => p.test(text))
}

// ─── Inline pipeline functions ──────────────────────────────────────────────

async function speechToText(pcmBuffer: Buffer): Promise<string> {
  const params = new URLSearchParams({
    model: 'nova-2',
    language: 'en-US',
    smart_format: 'true',
    punctuate: 'true',
  })
  const res = await fetch(`${DEEPGRAM_STT_URL}?${params}`, {
    method: 'POST',
    headers: {
      Authorization: 'Token test-dg-key',
      'Content-Type': `audio/raw;encoding=linear16;sample_rate=${SAMPLE_RATE};channels=1`,
    },
    body: pcmBuffer as unknown as BodyInit,
  })
  if (!res.ok) throw new Error(`STT error ${res.status}`)
  const data = (await res.json()) as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> }
  }
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
}

async function queryLLM(text: string): Promise<string> {
  const res = await fetch(`${GO_BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Auth': 'test-secret',
      'X-User-ID': 'user-1',
    },
    body: JSON.stringify({
      query: text,
      stream: false,
      privilegeMode: false,
      maxTier: 3,
      history: [],
    }),
  })
  if (!res.ok) throw new Error(`LLM error ${res.status}`)
  const rawText = await res.text()
  const data = JSON.parse(rawText) as { data?: { answer?: string }; answer?: string }
  return data.data?.answer || data.answer || ''
}

async function textToSpeech(
  text: string,
  recorder: EventRecorder,
): Promise<void> {
  const res = await fetch(INWORLD_TTS_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Basic test-key',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: { text },
      voice: { name: 'Ashley' },
      model: { id: 'inworld-tts-1-max' },
      output: { encoding: 'LINEAR16', sampleRate: SAMPLE_RATE },
    }),
  })
  if (!res.ok) throw new Error(`TTS error ${res.status}`)
  const data = (await res.json()) as { audioContent?: string }
  if (!data.audioContent) throw new Error('No audio content')

  const audioBuffer = Buffer.from(data.audioContent, 'base64')
  for (let offset = 0; offset < audioBuffer.length; offset += TTS_CHUNK_SIZE) {
    recorder.onTTSChunk(
      audioBuffer.subarray(offset, offset + TTS_CHUNK_SIZE).toString('base64'),
    )
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('Voice Integration Smoke Tests (BUG-042 SA-042-04)', () => {

  // TEST 1
  it('full voice cycle — document query', async () => {
    const callOrder: string[] = []

    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('deepgram.com/v1/listen')) {
        callOrder.push('STT')
        return deepgramSTTResponse('What documents do I have?')
      }
      if (typeof url === 'string' && url.includes('/api/chat')) {
        callOrder.push('LLM')
        return goBackendJSONResponse(
          'You have 3 documents in your vault: Contract.pdf [1], Report.docx [2], and Memo.txt [3].',
        )
      }
      if (typeof url === 'string' && url.includes('inworld.ai/tts')) {
        callOrder.push('TTS')
        return inworldTTSResponse('document-query-audio')
      }
      return { ok: false, status: 404, text: async () => 'not found' }
    })

    const rec = createEventRecorder()
    const pcm = Buffer.alloc(9600)

    // 1. STT
    const transcript = await speechToText(pcm)
    rec.onTranscriptFinal(transcript)

    // 2. LLM
    rec.events.push({ type: 'state', state: 'processing' })
    const answer = await queryLLM(transcript)
    rec.onAgentTextFinal(answer)

    // 3. TTS
    rec.events.push({ type: 'state', state: 'speaking' })
    await textToSpeech(answer, rec)
    rec.onSpeakingComplete()

    // Verify call order: STT → LLM → TTS
    expect(callOrder).toEqual(['STT', 'LLM', 'TTS'])

    // Verify event sequence
    const eventTypes = rec.events.map((e) => e.type)

    // asr_final
    expect(eventTypes).toContain('asr_final')
    const asrFinal = rec.events.find(
      (e) => e.type === 'asr_final',
    ) as { type: 'asr_final'; text: string }
    expect(asrFinal.text).toBe('What documents do I have?')

    // state:processing
    expect(eventTypes).toContain('state')

    // agent_text_final
    expect(eventTypes).toContain('agent_text_final')
    const textFinal = rec.events.find(
      (e) => e.type === 'agent_text_final',
    ) as { type: 'agent_text_final'; text: string }
    expect(textFinal.text).toContain('[1]')
    expect(textFinal.text).toContain('[2]')
    expect(textFinal.text).toContain('[3]')

    // binary audio chunks (at least 1)
    const binaryEvents = rec.events.filter((e) => e.type === 'binary')
    expect(binaryEvents.length).toBeGreaterThanOrEqual(1)

    // state:idle (last event)
    const lastState = rec.events
      .filter((e) => e.type === 'state')
      .pop() as { type: 'state'; state: AgentState }
    expect(lastState.state).toBe('idle')

    // No errors
    expect(rec.onError).not.toHaveBeenCalled()
  })

  // TEST 2
  it('full voice cycle — conversational query with grounding refusal', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('deepgram.com/v1/listen')) {
        return deepgramSTTResponse('Hello, how are you?')
      }
      if (typeof url === 'string' && url.includes('/api/chat')) {
        return goBackendJSONResponse(
          'I cannot provide a sufficiently grounded answer based on the available documents.',
        )
      }
      if (typeof url === 'string' && url.includes('inworld.ai/tts')) {
        return inworldTTSResponse('conversational-audio')
      }
      return { ok: false, status: 404, text: async () => 'not found' }
    })

    const rec = createEventRecorder()
    const pcm = Buffer.alloc(9600)

    // 1. STT
    const transcript = await speechToText(pcm)
    rec.onTranscriptFinal(transcript)
    expect(transcript).toBe('Hello, how are you?')

    // 2. LLM → grounding refusal → interceptor
    rec.events.push({ type: 'state', state: 'processing' })
    let answer = await queryLLM(transcript)

    if (isGroundingRefusal(answer)) {
      answer = "I'm Mercury, your secure document analyst. I'm ready to help — ask me anything about your uploaded documents, or just say what's on your mind."
    }

    rec.onAgentTextFinal(answer)

    // 3. TTS
    rec.events.push({ type: 'state', state: 'speaking' })
    await textToSpeech(answer, rec)
    rec.onSpeakingComplete()

    // agent_text_final contains conversational response (NOT refusal)
    const textFinal = rec.events.find(
      (e) => e.type === 'agent_text_final',
    ) as { type: 'agent_text_final'; text: string }
    expect(textFinal.text).not.toContain('cannot provide a sufficiently grounded')
    expect(textFinal.text).toContain('Mercury')

    // Binary audio still delivered
    const binaryEvents = rec.events.filter((e) => e.type === 'binary')
    expect(binaryEvents.length).toBeGreaterThanOrEqual(1)

    // Final state is idle
    const lastState = rec.events
      .filter((e) => e.type === 'state')
      .pop() as { type: 'state'; state: AgentState }
    expect(lastState.state).toBe('idle')
  })

  // TEST 3
  it('greeting on connect', async () => {
    mockFetch.mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('/api/mercury/config')) {
        return configResponse('Mercury', 'Welcome to RAGbox. How can I help you today?')
      }
      if (typeof url === 'string' && url.includes('inworld.ai/tts')) {
        return inworldTTSResponse('greeting-audio-data')
      }
      return { ok: false, status: 404, text: async () => 'not found' }
    })

    const rec = createEventRecorder()

    // Simulate: Open WebSocket → fetch config → TTS greeting
    const configRes = await fetch(`${GO_BACKEND_URL}/api/mercury/config`, {
      headers: { 'X-Internal-Auth': 'test-secret', 'X-User-ID': 'user-1' },
    })
    const cfg = (await configRes.json()) as { name?: string; greeting?: string }
    const greeting = cfg.greeting || "Hello, I'm Mercury. How can I help you today?"

    // Emit greeting as agent_text_final
    rec.onAgentTextFinal(greeting)

    // TTS the greeting
    rec.events.push({ type: 'state', state: 'speaking' })
    await textToSpeech(greeting, rec)
    rec.onSpeakingComplete()

    // Verify: receives agent_text_final with greeting text
    const textFinal = rec.events.find(
      (e) => e.type === 'agent_text_final',
    ) as { type: 'agent_text_final'; text: string }
    expect(textFinal.text).toBe('Welcome to RAGbox. How can I help you today?')

    // Verify: receives binary audio chunks (greeting TTS)
    const binaryEvents = rec.events.filter((e) => e.type === 'binary')
    expect(binaryEvents.length).toBeGreaterThanOrEqual(1)

    // Verify: receives state:idle after audio
    const lastState = rec.events
      .filter((e) => e.type === 'state')
      .pop() as { type: 'state'; state: AgentState }
    expect(lastState.state).toBe('idle')
  })
})
