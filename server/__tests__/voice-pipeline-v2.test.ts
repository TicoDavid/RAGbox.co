/**
 * Voice Pipeline v2 — Unit Tests
 *
 * Tests the hybrid voice pipeline: Deepgram STT + Go backend LLM + Inworld TTS
 * with Deepgram TTS fallback.
 *
 * Since Sheldon's voice-pipeline-v2.ts may not exist yet, these tests mock
 * the interfaces and validate the expected behavior. When Sheldon commits,
 * align mocks to his actual implementation.
 */

// ─── Mock global fetch ──────────────────────────────────────────────────────
const mockFetch = jest.fn()
;(global as any).fetch = mockFetch

// ─── Constants (mirroring expected v2 pipeline) ─────────────────────────────
const INWORLD_TTS_URL = 'https://api.inworld.ai/tts/v1/voice'
const DEEPGRAM_STT_URL = 'https://api.deepgram.com/v1/listen'
const DEEPGRAM_TTS_URL = 'https://api.deepgram.com/v1/speak'
const GO_BACKEND_CHAT_URL = 'http://localhost:8080/api/chat'
const GO_BACKEND_CONFIG_URL = 'http://localhost:8080/api/mercury/config'
const SAMPLE_RATE = 48000
const TTS_CHUNK_SIZE = 16384

// ─── Env setup ──────────────────────────────────────────────────────────────
const ORIGINAL_ENV = process.env

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    DEEPGRAM_API_KEY: 'test-deepgram-key',
    INWORLD_API_KEY: 'dGVzdC1pbndvcmxk', // base64 test key
    GO_BACKEND_URL: 'http://localhost:8080',
    INTERNAL_AUTH_SECRET: 'test-internal-secret',
  }
  mockFetch.mockReset()
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

// ─── Response helpers ───────────────────────────────────────────────────────

function inworldTTSResponse(audioText: string) {
  const audioContent = Buffer.from(audioText).toString('base64')
  return {
    ok: true,
    status: 200,
    json: async () => ({ audioContent }),
    text: async () => JSON.stringify({ audioContent }),
  }
}

function deepgramSTTResponse(transcript: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      results: {
        channels: [{
          alternatives: [{ transcript, confidence: 0.98 }],
        }],
      },
    }),
    text: async () => 'ok',
  }
}

function deepgramTTSResponse(audioText: string) {
  const buf = Buffer.from(audioText)
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
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

function goBackendSSEResponse(tokens: string[]) {
  let sse = ''
  for (const t of tokens) {
    sse += `event: token\ndata: ${JSON.stringify({ text: t })}\n\n`
  }
  sse += `event: done\ndata: {}\n\n`
  return {
    ok: true,
    status: 200,
    text: async () => sse,
  }
}

function errorResponse(status: number, body = 'error') {
  return {
    ok: false,
    status,
    text: async () => body,
    json: async () => ({ error: body }),
    arrayBuffer: async () => new ArrayBuffer(0),
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

// ─── VoiceSessionConfig mock ────────────────────────────────────────────────

interface MockCallbacks {
  onTranscriptPartial: jest.Mock
  onTranscriptFinal: jest.Mock
  onAgentTextPartial: jest.Mock
  onAgentTextFinal: jest.Mock
  onTTSChunk: jest.Mock
  onToolCall: jest.Mock
  onToolResult: jest.Mock
  onUIAction: jest.Mock
  onNoSpeech: jest.Mock
  onSpeakingComplete: jest.Mock
  onError: jest.Mock
  onDisconnect: jest.Mock
}

function createMockCallbacks(): MockCallbacks {
  return {
    onTranscriptPartial: jest.fn(),
    onTranscriptFinal: jest.fn(),
    onAgentTextPartial: jest.fn(),
    onAgentTextFinal: jest.fn(),
    onTTSChunk: jest.fn(),
    onToolCall: jest.fn(),
    onToolResult: jest.fn(),
    onUIAction: jest.fn(),
    onNoSpeech: jest.fn(),
    onSpeakingComplete: jest.fn(),
    onError: jest.fn(),
    onDisconnect: jest.fn(),
  }
}

// ─── Inline pipeline functions (mirror v2 expected behavior) ────────────────
// These replicate the logic Sheldon will implement. When he commits, these
// tests will import from voice-pipeline-v2.ts directly.

function chunkText(text: string, maxChars = 2000): string[] {
  if (text.length <= maxChars) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining)
      break
    }
    const region = remaining.slice(0, maxChars)
    const sentEnd = region.lastIndexOf('. ')
    const qEnd = region.lastIndexOf('? ')
    const eEnd = region.lastIndexOf('! ')
    let split = Math.max(sentEnd, qEnd, eEnd)
    if (split > 0) {
      split += 2
    } else {
      split = region.lastIndexOf(' ')
    }
    if (split <= 0) split = maxChars
    chunks.push(remaining.slice(0, split).trim())
    remaining = remaining.slice(split).trim()
  }
  return chunks.filter(c => c.length > 0)
}

async function speechToText(
  pcmBuffer: Buffer,
  deepgramKey: string,
  callbacks: MockCallbacks,
): Promise<string> {
  const params = new URLSearchParams({
    model: 'nova-2',
    language: 'en-US',
    smart_format: 'true',
    punctuate: 'true',
  })
  const res = await fetch(`${DEEPGRAM_STT_URL}?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${deepgramKey}`,
      'Content-Type': `audio/raw;encoding=linear16;sample_rate=${SAMPLE_RATE};channels=1`,
    },
    body: pcmBuffer as unknown as BodyInit,
  })
  if (!res.ok) throw new Error(`Deepgram STT error ${res.status}`)
  const data = (await res.json()) as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> }
  }
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || ''
}

async function queryLLM(
  text: string,
  goBackendUrl: string,
  internalAuth: string,
  userId: string,
  history: Array<{ role: string; content: string }>,
  callbacks: MockCallbacks,
): Promise<string> {
  history.push({ role: 'user', content: text })
  const res = await fetch(`${goBackendUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Auth': internalAuth,
      'X-User-ID': userId,
    },
    body: JSON.stringify({
      query: text,
      stream: false,
      privilegeMode: false,
      maxTier: 3,
      history: history.slice(-10),
    }),
  })
  if (!res.ok) throw new Error(`Backend error ${res.status}`)
  const rawText = await res.text()
  let answer = ''
  if (rawText.startsWith('{')) {
    const data = JSON.parse(rawText) as { data?: { answer?: string }; answer?: string }
    answer = data.data?.answer || data.answer || ''
  } else {
    const tokens: string[] = []
    let currentEventType = ''
    for (const line of rawText.split('\n')) {
      if (line.startsWith('event: ')) {
        currentEventType = line.slice(7).trim()
      } else if (line.startsWith('data: ')) {
        const dataStr = line.slice(6).trim()
        if (!dataStr) continue
        if (currentEventType === 'token') {
          try {
            const payload = JSON.parse(dataStr) as { text?: string }
            if (payload.text) tokens.push(payload.text)
          } catch { /* ignore */ }
        } else if (currentEventType === 'done') {
          if (!answer) answer = tokens.join('')
        }
        currentEventType = ''
      }
    }
    if (!answer) answer = tokens.join('')
  }
  history.push({ role: 'assistant', content: answer })
  return answer
}

async function inworldTTS(
  text: string,
  inworldKey: string,
  voiceId: string,
  callbacks: MockCallbacks,
  cancelledRef: { cancelled: boolean },
): Promise<void> {
  const chunks = chunkText(text, 2000)
  for (const chunk of chunks) {
    if (cancelledRef.cancelled) return
    const res = await fetch(INWORLD_TTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${inworldKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { text: chunk },
        voice: { name: voiceId },
        model: { id: 'inworld-tts-1-max' },
        output: { encoding: 'LINEAR16', sampleRate: SAMPLE_RATE },
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Inworld TTS ${res.status}: ${errText.substring(0, 200)}`)
    }
    const data = (await res.json()) as Record<string, unknown>
    const audioContent = (data.audioContent || (data as any).result?.audioContent) as string
    if (!audioContent) throw new Error('No audio content in Inworld response')
    const audioBuffer = Buffer.from(audioContent, 'base64')
    for (let offset = 0; offset < audioBuffer.length; offset += TTS_CHUNK_SIZE) {
      if (cancelledRef.cancelled) return
      callbacks.onTTSChunk(audioBuffer.subarray(offset, offset + TTS_CHUNK_SIZE).toString('base64'))
    }
  }
}

async function deepgramTTS(
  text: string,
  deepgramKey: string,
  callbacks: MockCallbacks,
  cancelledRef: { cancelled: boolean },
): Promise<void> {
  if (cancelledRef.cancelled) return
  const params = new URLSearchParams({
    model: 'aura-asteria-en',
    encoding: 'linear16',
    sample_rate: String(SAMPLE_RATE),
  })
  const res = await fetch(`${DEEPGRAM_TTS_URL}?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${deepgramKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`Deepgram TTS error ${res.status}`)
  const audioArrayBuffer = await res.arrayBuffer()
  const audioBuffer = Buffer.from(audioArrayBuffer)
  for (let offset = 0; offset < audioBuffer.length; offset += TTS_CHUNK_SIZE) {
    if (cancelledRef.cancelled) break
    callbacks.onTTSChunk(audioBuffer.subarray(offset, offset + TTS_CHUNK_SIZE).toString('base64'))
  }
}

async function textToSpeech(
  text: string,
  inworldKey: string,
  deepgramKey: string,
  voiceId: string,
  callbacks: MockCallbacks,
  cancelledRef: { cancelled: boolean },
): Promise<void> {
  if (cancelledRef.cancelled) return
  try {
    await inworldTTS(text, inworldKey, voiceId, callbacks, cancelledRef)
  } catch {
    await deepgramTTS(text, deepgramKey, callbacks, cancelledRef)
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('voice-pipeline-v2', () => {
  // ─── 1.1 Inworld TTS — success path ────────────────────────────────────
  describe('1.1 Inworld TTS — success path', () => {
    it('sends Authorization header as "Basic <key>"', async () => {
      mockFetch.mockResolvedValueOnce(inworldTTSResponse('audio-data'))
      const cb = createMockCallbacks()
      const cancel = { cancelled: false }

      await inworldTTS('Hello world', 'dGVzdC1pbndvcmxk', 'Ashley', cb, cancel)

      const call = mockFetch.mock.calls[0]
      expect(call[0]).toBe(INWORLD_TTS_URL)
      expect(call[1].headers.Authorization).toBe('Basic dGVzdC1pbndvcmxk')
    })

    it('sends correct request body with input.text, voice.name, model.id, output.*', async () => {
      mockFetch.mockResolvedValueOnce(inworldTTSResponse('audio-data'))
      const cb = createMockCallbacks()
      const cancel = { cancelled: false }

      await inworldTTS('Test text', 'key123', 'Ashley', cb, cancel)

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.input.text).toBe('Test text')
      expect(body.voice.name).toBe('Ashley')
      expect(body.model.id).toBe('inworld-tts-1-max')
      expect(body.output.encoding).toBe('LINEAR16')
      expect(body.output.sampleRate).toBe(SAMPLE_RATE)
    })

    it('delivers audio via onTTSChunk callback as base64-encoded PCM', async () => {
      const audioData = 'hello-audio-pcm-data'
      mockFetch.mockResolvedValueOnce(inworldTTSResponse(audioData))
      const cb = createMockCallbacks()
      const cancel = { cancelled: false }

      await inworldTTS('Hello', 'key', 'Ashley', cb, cancel)

      expect(cb.onTTSChunk).toHaveBeenCalled()
      // Decode back and verify it matches the original audio content
      const receivedBase64 = cb.onTTSChunk.mock.calls[0][0]
      const decoded = Buffer.from(receivedBase64, 'base64')
      expect(decoded.toString()).toBe(audioData)
    })
  })

  // ─── 1.2 Inworld TTS — fallback to Deepgram ────────────────────────────
  describe('1.2 Inworld TTS — fallback to Deepgram', () => {
    it('calls Deepgram TTS when Inworld returns 500', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(500, 'Inworld down'))
        .mockResolvedValueOnce(deepgramTTSResponse('fallback-audio'))
      const cb = createMockCallbacks()
      const cancel = { cancelled: false }

      await textToSpeech('Hello', 'iw-key', 'dg-key', 'Ashley', cb, cancel)

      // First call = Inworld (failed), second = Deepgram (fallback)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch.mock.calls[0][0]).toBe(INWORLD_TTS_URL)
      expect(mockFetch.mock.calls[1][0]).toContain(DEEPGRAM_TTS_URL)
    })

    it('still delivers audio to client via onTTSChunk after fallback', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(500, 'Inworld down'))
        .mockResolvedValueOnce(deepgramTTSResponse('fallback-audio'))
      const cb = createMockCallbacks()
      const cancel = { cancelled: false }

      await textToSpeech('Hello', 'iw-key', 'dg-key', 'Ashley', cb, cancel)

      expect(cb.onTTSChunk).toHaveBeenCalled()
    })

    it('does not crash — session stays alive', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(500, 'Inworld down'))
        .mockResolvedValueOnce(deepgramTTSResponse('fallback'))
      const cb = createMockCallbacks()
      const cancel = { cancelled: false }

      // Should not throw
      await expect(
        textToSpeech('Hello', 'iw-key', 'dg-key', 'Ashley', cb, cancel),
      ).resolves.toBeUndefined()
      expect(cb.onError).not.toHaveBeenCalled()
    })
  })

  // ─── 1.3 Inworld TTS — text chunking ───────────────────────────────────
  describe('1.3 Inworld TTS — text chunking', () => {
    it('splits text > 2000 chars at sentence boundaries', () => {
      const longText = 'A'.repeat(1500) + '. ' + 'B'.repeat(1500)
      const chunks = chunkText(longText, 2000)

      expect(chunks.length).toBeGreaterThan(1)
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(2000)
      }
    })

    it('makes multiple Inworld API calls (one per chunk)', async () => {
      const longText = 'First sentence here. ' + 'A'.repeat(1900) + '. ' + 'B'.repeat(500)
      const expectedChunks = chunkText(longText, 2000)

      mockFetch.mockImplementation(async () => inworldTTSResponse('chunk-audio'))
      const cb = createMockCallbacks()
      const cancel = { cancelled: false }

      await inworldTTS(longText, 'key', 'Ashley', cb, cancel)

      expect(mockFetch).toHaveBeenCalledTimes(expectedChunks.length)
    })

    it('delivers audio from all chunks in order', async () => {
      const longText = 'A'.repeat(1500) + '. ' + 'B'.repeat(1500)
      let callIdx = 0
      mockFetch.mockImplementation(async () => {
        const label = `chunk-${callIdx++}`
        return inworldTTSResponse(label)
      })
      const cb = createMockCallbacks()
      const cancel = { cancelled: false }

      await inworldTTS(longText, 'key', 'Ashley', cb, cancel)

      // At least 2 chunks delivered
      expect(cb.onTTSChunk.mock.calls.length).toBeGreaterThanOrEqual(2)
      // First chunk audio should decode to 'chunk-0'
      const first = Buffer.from(cb.onTTSChunk.mock.calls[0][0], 'base64').toString()
      expect(first).toBe('chunk-0')
    })
  })

  // ─── 1.4 Deepgram STT — success path ───────────────────────────────────
  describe('1.4 Deepgram STT — success path', () => {
    it('sends correct Content-Type for raw PCM audio', async () => {
      mockFetch.mockResolvedValueOnce(deepgramSTTResponse('Hello world'))
      const cb = createMockCallbacks()
      const pcm = Buffer.alloc(9600) // 100ms of 48kHz 16-bit mono

      await speechToText(pcm, 'dg-key', cb)

      const headers = mockFetch.mock.calls[0][1].headers
      expect(headers['Content-Type']).toBe(
        `audio/raw;encoding=linear16;sample_rate=${SAMPLE_RATE};channels=1`,
      )
    })

    it('extracts transcript from Deepgram response', async () => {
      mockFetch.mockResolvedValueOnce(deepgramSTTResponse('How are you today'))
      const cb = createMockCallbacks()
      const pcm = Buffer.alloc(9600)

      const transcript = await speechToText(pcm, 'dg-key', cb)

      expect(transcript).toBe('How are you today')
    })

    it('uses Authorization: Token <key>', async () => {
      mockFetch.mockResolvedValueOnce(deepgramSTTResponse('test'))
      const cb = createMockCallbacks()

      await speechToText(Buffer.alloc(100), 'my-deepgram-key', cb)

      expect(mockFetch.mock.calls[0][1].headers.Authorization).toBe('Token my-deepgram-key')
    })
  })

  // ─── 1.5 Go backend LLM — JSON response ────────────────────────────────
  describe('1.5 Go backend LLM — JSON response', () => {
    it('extracts answer from JSON { data: { answer } }', async () => {
      mockFetch.mockResolvedValueOnce(goBackendJSONResponse('The answer is 42'))
      const cb = createMockCallbacks()
      const history: Array<{ role: string; content: string }> = []

      const answer = await queryLLM(
        'What is the meaning of life?',
        'http://localhost:8080',
        'secret',
        'user-1',
        history,
        cb,
      )

      expect(answer).toBe('The answer is 42')
    })

    it('updates conversation history', async () => {
      mockFetch.mockResolvedValueOnce(goBackendJSONResponse('test answer'))
      const cb = createMockCallbacks()
      const history: Array<{ role: string; content: string }> = []

      await queryLLM('hello', 'http://localhost:8080', 'secret', 'user-1', history, cb)

      expect(history).toHaveLength(2)
      expect(history[0]).toEqual({ role: 'user', content: 'hello' })
      expect(history[1]).toEqual({ role: 'assistant', content: 'test answer' })
    })

    it('sends correct headers (X-Internal-Auth, X-User-ID)', async () => {
      mockFetch.mockResolvedValueOnce(goBackendJSONResponse('ok'))
      const cb = createMockCallbacks()

      await queryLLM('hi', 'http://localhost:8080', 'my-secret', 'user-42', [], cb)

      const headers = mockFetch.mock.calls[0][1].headers
      expect(headers['X-Internal-Auth']).toBe('my-secret')
      expect(headers['X-User-ID']).toBe('user-42')
    })
  })

  // ─── 1.6 Go backend LLM — SSE response ─────────────────────────────────
  describe('1.6 Go backend LLM — SSE response', () => {
    it('concatenates SSE tokens correctly', async () => {
      mockFetch.mockResolvedValueOnce(goBackendSSEResponse(['Hello ', 'world']))
      const cb = createMockCallbacks()

      const answer = await queryLLM('hi', 'http://localhost:8080', 's', 'u', [], cb)

      expect(answer).toBe('Hello world')
    })

    it('handles multi-token SSE with done event', async () => {
      mockFetch.mockResolvedValueOnce(
        goBackendSSEResponse(['The ', 'answer ', 'is ', '42.']),
      )
      const cb = createMockCallbacks()

      const answer = await queryLLM('q', 'http://localhost:8080', 's', 'u', [], cb)

      expect(answer).toBe('The answer is 42.')
    })
  })

  // ─── 1.7 Full pipeline flow — STT → LLM → TTS ─────────────────────────
  describe('1.7 Full pipeline flow — STT → LLM → TTS', () => {
    it('processes audio through all three stages in order', async () => {
      const callOrder: string[] = []
      mockFetch.mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('deepgram.com/v1/listen')) {
          callOrder.push('STT')
          return deepgramSTTResponse('What is RAGbox?')
        }
        if (typeof url === 'string' && url.includes('/api/chat')) {
          callOrder.push('LLM')
          return goBackendJSONResponse('RAGbox is a RAG platform.')
        }
        if (typeof url === 'string' && url.includes('inworld.ai/tts')) {
          callOrder.push('TTS')
          return inworldTTSResponse('audio-response')
        }
        return errorResponse(404)
      })

      const cb = createMockCallbacks()
      const cancel = { cancelled: false }
      const history: Array<{ role: string; content: string }> = []

      // Simulate full pipeline: STT → LLM → TTS
      const pcm = Buffer.alloc(9600)
      const transcript = await speechToText(pcm, 'dg-key', cb)
      expect(transcript).toBe('What is RAGbox?')
      cb.onTranscriptFinal(transcript)

      const answer = await queryLLM(transcript, 'http://localhost:8080', 's', 'u', history, cb)
      expect(answer).toBe('RAGbox is a RAG platform.')
      cb.onAgentTextFinal(answer)

      await textToSpeech(answer, 'iw-key', 'dg-key', 'Ashley', cb, cancel)
      cb.onSpeakingComplete()

      // Verify call order
      expect(callOrder).toEqual(['STT', 'LLM', 'TTS'])

      // Verify all callbacks fired
      expect(cb.onTranscriptFinal).toHaveBeenCalledWith('What is RAGbox?')
      expect(cb.onAgentTextFinal).toHaveBeenCalledWith('RAGbox is a RAG platform.')
      expect(cb.onTTSChunk).toHaveBeenCalled()
      expect(cb.onSpeakingComplete).toHaveBeenCalled()
    })
  })

  // ─── 1.8 Cancellation ──────────────────────────────────────────────────
  describe('1.8 Cancellation', () => {
    it('stops TTS from sending more chunks when cancelled', async () => {
      // Return a large audio payload that would produce multiple chunks
      const largeAudio = 'X'.repeat(TTS_CHUNK_SIZE * 3)
      mockFetch.mockResolvedValueOnce(inworldTTSResponse(largeAudio))
      const cb = createMockCallbacks()
      const cancel = { cancelled: false }

      // Cancel after first chunk callback
      cb.onTTSChunk.mockImplementationOnce(() => {
        cancel.cancelled = true
      })

      await inworldTTS('Test', 'key', 'Ashley', cb, cancel)

      // Should have stopped after 1 chunk (cancelled after first)
      expect(cb.onTTSChunk).toHaveBeenCalledTimes(1)
    })

    it('does not crash on cancellation', async () => {
      const cancel = { cancelled: true }
      const cb = createMockCallbacks()

      // Pre-cancelled — should return immediately
      await expect(
        textToSpeech('Hello', 'iw', 'dg', 'Ashley', cb, cancel),
      ).resolves.toBeUndefined()

      expect(mockFetch).not.toHaveBeenCalled()
      expect(cb.onTTSChunk).not.toHaveBeenCalled()
    })
  })

  // ─── 1.9 Greeting ──────────────────────────────────────────────────────
  describe('1.9 Greeting', () => {
    it('fetches config and uses custom name/greeting for TTS', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('/api/mercury/config')) {
          return configResponse('Mercury', 'Welcome to RAGbox!')
        }
        if (typeof url === 'string' && url.includes('inworld.ai/tts')) {
          return inworldTTSResponse('greeting-audio')
        }
        return errorResponse(404)
      })

      const cb = createMockCallbacks()
      const cancel = { cancelled: false }

      // Simulate triggerGreeting: fetch config, then TTS
      const configRes = await fetch(GO_BACKEND_CONFIG_URL, {
        headers: { 'X-Internal-Auth': 'secret', 'X-User-ID': 'user-1' },
      })
      const cfg = (await configRes.json()) as { name?: string; greeting?: string }
      const greeting = cfg.greeting || `Hello, I'm ${cfg.name || 'Mercury'}. How can I help you today?`

      cb.onAgentTextFinal(greeting)
      await textToSpeech(greeting, 'iw-key', 'dg-key', 'Ashley', cb, cancel)
      cb.onSpeakingComplete()

      expect(cb.onAgentTextFinal).toHaveBeenCalledWith('Welcome to RAGbox!')
      expect(cb.onTTSChunk).toHaveBeenCalled()
      expect(cb.onSpeakingComplete).toHaveBeenCalled()
    })
  })

  // ─── 1.10 Greeting — config endpoint unavailable ────────────────────────
  describe('1.10 Greeting — config endpoint unavailable', () => {
    it('falls back to default greeting when config returns 404', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('/api/mercury/config')) {
          return errorResponse(404)
        }
        if (typeof url === 'string' && url.includes('inworld.ai/tts')) {
          return inworldTTSResponse('greeting-audio')
        }
        return errorResponse(404)
      })

      const cb = createMockCallbacks()
      const cancel = { cancelled: false }

      // Simulate triggerGreeting with failed config fetch
      const configRes = await fetch(GO_BACKEND_CONFIG_URL, {
        headers: { 'X-Internal-Auth': 'secret', 'X-User-ID': 'user-1' },
      })

      let greeting: string
      if (configRes.ok) {
        const cfg = (await configRes.json()) as { name?: string; greeting?: string }
        greeting = cfg.greeting || `Hello, I'm ${cfg.name || 'Mercury'}. How can I help you today?`
      } else {
        greeting = "Hello, I'm Mercury. How can I help you today?"
      }

      cb.onAgentTextFinal(greeting)
      await textToSpeech(greeting, 'iw-key', 'dg-key', 'Ashley', cb, cancel)
      cb.onSpeakingComplete()

      expect(greeting).toBe("Hello, I'm Mercury. How can I help you today?")
      expect(cb.onAgentTextFinal).toHaveBeenCalledWith(
        "Hello, I'm Mercury. How can I help you today?",
      )
      expect(cb.onTTSChunk).toHaveBeenCalled()
    })

    it('does not crash when config endpoint throws', async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (typeof url === 'string' && url.includes('/api/mercury/config')) {
          throw new Error('Network error')
        }
        if (typeof url === 'string' && url.includes('inworld.ai/tts')) {
          return inworldTTSResponse('greeting-audio')
        }
        return errorResponse(404)
      })

      const cb = createMockCallbacks()
      const cancel = { cancelled: false }

      // Simulate triggerGreeting with network error
      let greeting = "Hello, I'm Mercury. How can I help you today?"
      try {
        await fetch(GO_BACKEND_CONFIG_URL)
      } catch {
        // Config unavailable — use default
      }

      cb.onAgentTextFinal(greeting)
      await textToSpeech(greeting, 'iw-key', 'dg-key', 'Ashley', cb, cancel)

      expect(cb.onAgentTextFinal).toHaveBeenCalledWith(greeting)
      expect(cb.onTTSChunk).toHaveBeenCalled()
    })
  })
})
