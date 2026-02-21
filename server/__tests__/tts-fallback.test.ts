/**
 * TTS Fallback Stress Tests
 *
 * Tests the Inworld TTS → Deepgram TTS fallback behavior under various
 * failure scenarios: persistent failures, intermittent failures, and
 * total provider outage.
 */

// ─── Mock global fetch ──────────────────────────────────────────────────────
const mockFetch = jest.fn()
;(global as any).fetch = mockFetch

const INWORLD_TTS_URL = 'https://api.inworld.ai/tts/v1/voice'
const DEEPGRAM_TTS_URL = 'https://api.deepgram.com/v1/speak'
const SAMPLE_RATE = 48000
const TTS_CHUNK_SIZE = 16384

beforeEach(() => {
  mockFetch.mockReset()
})

// ─── Response helpers ───────────────────────────────────────────────────────

function inworldOK(audioText: string) {
  const audioContent = Buffer.from(audioText).toString('base64')
  return {
    ok: true,
    status: 200,
    json: async () => ({ audioContent }),
    text: async () => JSON.stringify({ audioContent }),
  }
}

function deepgramOK(audioText: string) {
  const buf = Buffer.from(audioText)
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    text: async () => 'ok',
  }
}

function errorResp(status: number, body = 'error') {
  return {
    ok: false,
    status,
    text: async () => body,
    json: async () => ({ error: body }),
    arrayBuffer: async () => new ArrayBuffer(0),
  }
}

// ─── Mock callbacks ─────────────────────────────────────────────────────────

function createCallbacks() {
  return {
    onTTSChunk: jest.fn(),
    onError: jest.fn(),
    onSpeakingComplete: jest.fn(),
  }
}

// ─── TTS functions (mirroring v2 pipeline logic) ────────────────────────────

async function inworldTTS(
  text: string,
  cb: ReturnType<typeof createCallbacks>,
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

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Inworld TTS ${res.status}: ${errText}`)
  }

  const data = (await res.json()) as { audioContent?: string }
  if (!data.audioContent) throw new Error('No audio content')

  const audioBuffer = Buffer.from(data.audioContent, 'base64')
  for (let offset = 0; offset < audioBuffer.length; offset += TTS_CHUNK_SIZE) {
    cb.onTTSChunk(audioBuffer.subarray(offset, offset + TTS_CHUNK_SIZE).toString('base64'))
  }
}

async function deepgramTTS(
  text: string,
  cb: ReturnType<typeof createCallbacks>,
): Promise<void> {
  const params = new URLSearchParams({
    model: 'aura-asteria-en',
    encoding: 'linear16',
    sample_rate: String(SAMPLE_RATE),
  })
  const res = await fetch(`${DEEPGRAM_TTS_URL}?${params}`, {
    method: 'POST',
    headers: {
      Authorization: 'Token test-dg-key',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    throw new Error(`Deepgram TTS error ${res.status}`)
  }

  const audioArrayBuffer = await res.arrayBuffer()
  const audioBuffer = Buffer.from(audioArrayBuffer)
  for (let offset = 0; offset < audioBuffer.length; offset += TTS_CHUNK_SIZE) {
    cb.onTTSChunk(audioBuffer.subarray(offset, offset + TTS_CHUNK_SIZE).toString('base64'))
  }
}

async function textToSpeechWithFallback(
  text: string,
  cb: ReturnType<typeof createCallbacks>,
): Promise<void> {
  try {
    await inworldTTS(text, cb)
  } catch (inworldError) {
    // Log warning (not error to client)
    console.warn('[TTS Fallback] Inworld failed, falling back to Deepgram:',
      inworldError instanceof Error ? inworldError.message : inworldError)
    try {
      await deepgramTTS(text, cb)
    } catch (deepgramError) {
      cb.onError(deepgramError instanceof Error ? deepgramError : new Error(String(deepgramError)))
    }
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe('TTS Fallback Stress Tests', () => {
  const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

  afterEach(() => {
    consoleSpy.mockClear()
  })

  afterAll(() => {
    consoleSpy.mockRestore()
  })

  // ─── 3.1 Inworld always fails → Deepgram always used ─────────────────
  describe('3.1 Inworld always fails → Deepgram always used', () => {
    it('uses Deepgram fallback for all 5 messages', async () => {
      const cb = createCallbacks()

      for (let i = 0; i < 5; i++) {
        mockFetch
          .mockResolvedValueOnce(errorResp(500, 'Inworld down'))
          .mockResolvedValueOnce(deepgramOK(`audio-${i}`))

        await textToSpeechWithFallback(`Message ${i}`, cb)
      }

      // 5 Inworld attempts + 5 Deepgram fallbacks = 10 total
      expect(mockFetch).toHaveBeenCalledTimes(10)

      // All 5 should have delivered audio
      expect(cb.onTTSChunk.mock.calls.length).toBe(5)

      // Verify all Inworld calls hit the right URL
      for (let i = 0; i < 10; i += 2) {
        expect(mockFetch.mock.calls[i][0]).toBe(INWORLD_TTS_URL)
      }
      // Verify all Deepgram calls hit the right URL
      for (let i = 1; i < 10; i += 2) {
        expect(mockFetch.mock.calls[i][0]).toContain(DEEPGRAM_TTS_URL)
      }
    })

    it('emits warnings 5 times (not errors to client)', async () => {
      const cb = createCallbacks()

      for (let i = 0; i < 5; i++) {
        mockFetch
          .mockResolvedValueOnce(errorResp(500, 'Inworld down'))
          .mockResolvedValueOnce(deepgramOK(`audio-${i}`))

        await textToSpeechWithFallback(`Message ${i}`, cb)
      }

      // console.warn called 5 times (one per fallback)
      expect(consoleSpy).toHaveBeenCalledTimes(5)
      // No errors reported to client
      expect(cb.onError).not.toHaveBeenCalled()
    })

    it('does not accumulate state between calls', async () => {
      const cb = createCallbacks()

      for (let i = 0; i < 5; i++) {
        mockFetch
          .mockResolvedValueOnce(errorResp(500, 'Inworld down'))
          .mockResolvedValueOnce(deepgramOK(`audio-${i}`))

        await textToSpeechWithFallback(`Message ${i}`, cb)
      }

      // Each message should produce exactly 1 audio chunk
      // (small text = single chunk per message)
      expect(cb.onTTSChunk).toHaveBeenCalledTimes(5)

      // Verify each chunk is different (proving no state leak)
      const chunks = cb.onTTSChunk.mock.calls.map(
        (call: [string]) => Buffer.from(call[0], 'base64').toString(),
      )
      const uniqueChunks = new Set(chunks)
      expect(uniqueChunks.size).toBe(5)
    })
  })

  // ─── 3.2 Inworld intermittent → mixed providers ──────────────────────
  describe('3.2 Inworld intermittent → mixed providers', () => {
    it('uses Inworld for 1,3,5 and Deepgram for 2,4', async () => {
      const cb = createCallbacks()
      const providers: string[] = []

      // Pattern: succeed, fail, succeed, fail, succeed
      const inworldSucceeds = [true, false, true, false, true]

      for (let i = 0; i < 5; i++) {
        if (inworldSucceeds[i]) {
          // Inworld succeeds — only 1 fetch call
          mockFetch.mockResolvedValueOnce(inworldOK(`inworld-audio-${i}`))
          await textToSpeechWithFallback(`Message ${i}`, cb)
          providers.push('inworld')
        } else {
          // Inworld fails, Deepgram fallback — 2 fetch calls
          mockFetch
            .mockResolvedValueOnce(errorResp(500, 'intermittent'))
            .mockResolvedValueOnce(deepgramOK(`deepgram-audio-${i}`))
          await textToSpeechWithFallback(`Message ${i}`, cb)
          providers.push('deepgram')
        }
      }

      expect(providers).toEqual(['inworld', 'deepgram', 'inworld', 'deepgram', 'inworld'])

      // All 5 should have audio delivered
      expect(cb.onTTSChunk).toHaveBeenCalledTimes(5)
      expect(cb.onError).not.toHaveBeenCalled()
    })

    it('delivers audio from both providers correctly', async () => {
      const cb = createCallbacks()

      // Succeed → Fail → Succeed
      mockFetch.mockResolvedValueOnce(inworldOK('IW-audio'))
      await textToSpeechWithFallback('First', cb)

      mockFetch
        .mockResolvedValueOnce(errorResp(500))
        .mockResolvedValueOnce(deepgramOK('DG-audio'))
      await textToSpeechWithFallback('Second', cb)

      mockFetch.mockResolvedValueOnce(inworldOK('IW-audio-2'))
      await textToSpeechWithFallback('Third', cb)

      expect(cb.onTTSChunk).toHaveBeenCalledTimes(3)

      // Decode and verify providers
      const chunk0 = Buffer.from(cb.onTTSChunk.mock.calls[0][0], 'base64').toString()
      const chunk1 = Buffer.from(cb.onTTSChunk.mock.calls[1][0], 'base64').toString()
      const chunk2 = Buffer.from(cb.onTTSChunk.mock.calls[2][0], 'base64').toString()

      expect(chunk0).toBe('IW-audio')
      expect(chunk1).toBe('DG-audio')
      expect(chunk2).toBe('IW-audio-2')
    })
  })

  // ─── 3.3 Both providers fail → graceful error ────────────────────────
  describe('3.3 Both providers fail → graceful error', () => {
    it('calls onError with meaningful message when both fail', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResp(500, 'Inworld down'))
        .mockResolvedValueOnce(errorResp(500, 'Deepgram also down'))

      const cb = createCallbacks()
      await textToSpeechWithFallback('Hello', cb)

      expect(cb.onError).toHaveBeenCalledTimes(1)
      const error = cb.onError.mock.calls[0][0] as Error
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toContain('Deepgram TTS error 500')
    })

    it('session stays alive — no throw', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResp(500, 'Inworld down'))
        .mockResolvedValueOnce(errorResp(500, 'Deepgram down'))

      const cb = createCallbacks()

      // Should not throw
      await expect(textToSpeechWithFallback('Hello', cb)).resolves.toBeUndefined()
    })

    it('next message can still be processed after total failure', async () => {
      const cb = createCallbacks()

      // First message: both fail
      mockFetch
        .mockResolvedValueOnce(errorResp(500, 'IW fail'))
        .mockResolvedValueOnce(errorResp(500, 'DG fail'))
      await textToSpeechWithFallback('First', cb)

      expect(cb.onError).toHaveBeenCalledTimes(1)

      // Second message: Inworld recovers
      mockFetch.mockResolvedValueOnce(inworldOK('recovered-audio'))
      await textToSpeechWithFallback('Second', cb)

      // Should have audio from second message
      expect(cb.onTTSChunk).toHaveBeenCalled()
      const audio = Buffer.from(cb.onTTSChunk.mock.calls[0][0], 'base64').toString()
      expect(audio).toBe('recovered-audio')

      // Error count should still be 1 (only from first message)
      expect(cb.onError).toHaveBeenCalledTimes(1)
    })

    it('no audio chunks are sent when both providers fail', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResp(500, 'IW fail'))
        .mockResolvedValueOnce(errorResp(500, 'DG fail'))

      const cb = createCallbacks()
      await textToSpeechWithFallback('Hello', cb)

      expect(cb.onTTSChunk).not.toHaveBeenCalled()
    })
  })
})
