/**
 * BUG-042 SA-042-03: TTS Audio Delivery Tests
 *
 * Tests that TTS audio chunks are actually delivered to the client
 * correctly — base64 PCM frames, callback ordering, fallback behavior,
 * empty response handling, large response chunking, and audio format
 * conversion correctness.
 *
 * TTS is the active blocker (2026-02-27) — prioritized by David.
 *
 * KEY FINDING: v3 pipeline sends base64 strings via onTTSChunk, NOT
 * raw Buffers. The WebSocket handler (agent-ws.ts) decodes to binary.
 * Tests must verify base64 string output, not Buffer output.
 *
 * — Sarah, QA
 */

// ─── float32ToInt16Base64: replicated from voice-pipeline-v3.ts ─────────────
// This is THE critical function for audio delivery. Every TTS chunk passes
// through it. If it corrupts data or drops samples, the user hears nothing
// (or garbage). Replicated here because it's not exported from v3.
// TODO: align with Sheldon's commit if he exports it or changes the math.

function float32ToInt16Base64(float32Base64: string): string {
  const buffer = Buffer.from(float32Base64, 'base64')
  const float32 = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.length / 4,
  )
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
  }
  return Buffer.from(int16.buffer).toString('base64')
}

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

/** Inworld returns float32 audio as base64. We simulate that. */
function inworldFloat32Response(sampleCount: number) {
  const float32 = new Float32Array(sampleCount)
  for (let i = 0; i < sampleCount; i++) {
    // Realistic audio: sine wave at ~440Hz
    float32[i] = Math.sin((2 * Math.PI * 440 * i) / SAMPLE_RATE) * 0.5
  }
  const audioContent = Buffer.from(float32.buffer).toString('base64')
  return {
    ok: true,
    status: 200,
    json: async () => ({ audioContent }),
    text: async () => JSON.stringify({ audioContent }),
  }
}

function inworldOKSized(byteLength: number) {
  const buf = Buffer.alloc(byteLength, 0x42)
  const audioContent = buf.toString('base64')
  return {
    ok: true,
    status: 200,
    json: async () => ({ audioContent }),
    text: async () => JSON.stringify({ audioContent }),
  }
}

function deepgramOK(audioData: string) {
  const buf = Buffer.from(audioData)
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
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

interface TTSCallbacks {
  onTTSChunk: jest.Mock
  onSpeakingComplete: jest.Mock
  onError: jest.Mock
}

function createCallbacks(): TTSCallbacks {
  return {
    onTTSChunk: jest.fn(),
    onSpeakingComplete: jest.fn(),
    onError: jest.fn(),
  }
}

// ─── Text chunking (for large response test) ───────────────────────────────

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
  return chunks.filter((c) => c.length > 0)
}

// ─── Inline TTS functions (mirror v3 pipeline interface) ────────────────────
// In v3, Inworld TTS returns float32 base64 → float32ToInt16Base64 → onTTSChunk(base64String)
// These mock functions replicate that flow for testing.

async function inworldTTS(
  text: string,
  cb: TTSCallbacks,
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

  // v3 pipeline: convert float32 base64 → int16 base64, send as string
  const int16Base64 = float32ToInt16Base64(data.audioContent)
  const audioBuffer = Buffer.from(int16Base64, 'base64')

  // Chunk at TTS_CHUNK_SIZE and emit each chunk as base64 string
  for (let offset = 0; offset < audioBuffer.length; offset += TTS_CHUNK_SIZE) {
    const chunk = audioBuffer.subarray(offset, offset + TTS_CHUNK_SIZE)
    cb.onTTSChunk(chunk.toString('base64'))
  }
}

async function deepgramTTS(
  text: string,
  cb: TTSCallbacks,
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

  if (!res.ok) throw new Error(`Deepgram TTS error ${res.status}`)

  const audioArrayBuffer = await res.arrayBuffer()
  const audioBuffer = Buffer.from(audioArrayBuffer)

  // Emit as base64 strings (matching v3 interface)
  for (let offset = 0; offset < audioBuffer.length; offset += TTS_CHUNK_SIZE) {
    const chunk = audioBuffer.subarray(offset, offset + TTS_CHUNK_SIZE)
    cb.onTTSChunk(chunk.toString('base64'))
  }
}

async function textToSpeechWithFallback(
  text: string,
  cb: TTSCallbacks,
): Promise<void> {
  if (!text || text.trim().length === 0) {
    console.warn('[TTS] Empty text — skipping TTS')
    cb.onSpeakingComplete()
    return
  }
  try {
    await inworldTTS(text, cb)
  } catch {
    try {
      await deepgramTTS(text, cb)
    } catch (deepgramError) {
      cb.onError(
        deepgramError instanceof Error
          ? deepgramError
          : new Error(String(deepgramError)),
      )
    }
  }
  cb.onSpeakingComplete()
}

// ============================================================================
// SPEC TESTS (SA-042-03 orders)
// ============================================================================

describe('TTS Audio Delivery (BUG-042 SA-042-03)', () => {
  const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

  afterEach(() => {
    consoleSpy.mockClear()
  })

  afterAll(() => {
    consoleSpy.mockRestore()
  })

  // TEST 1: TTS chunks are sent as base64 audio frames
  it('TTS chunks are sent as base64 audio strings via onTTSChunk', async () => {
    // 4800 float32 samples = 19200 bytes float32 = ~9600 bytes int16
    // At 16KB chunk size, this produces 1 chunk
    // Use 10 * TTS_CHUNK_SIZE * 2 float32 bytes to get 10 int16 chunks
    const sampleCount = (TTS_CHUNK_SIZE * 10) / 2 // 10 chunks of int16 output
    mockFetch.mockResolvedValueOnce(inworldFloat32Response(sampleCount))

    const cb = createCallbacks()
    await inworldTTS('Generate ten chunks of audio', cb)

    // Should receive exactly 10 base64 frames
    expect(cb.onTTSChunk).toHaveBeenCalledTimes(10)

    // Each frame is a non-empty base64 string (v3 sends strings, NOT Buffers)
    for (const call of cb.onTTSChunk.mock.calls) {
      const chunkBase64 = call[0] as string
      expect(typeof chunkBase64).toBe('string')
      expect(chunkBase64.length).toBeGreaterThan(0)

      // Valid base64 that decodes to non-empty audio
      const decoded = Buffer.from(chunkBase64, 'base64')
      expect(decoded.length).toBeGreaterThan(0)
    }
  })

  // TEST 2: onSpeakingComplete fires AFTER all TTS chunks sent
  it('onSpeakingComplete fires AFTER all TTS chunks sent', async () => {
    const sampleCount = (TTS_CHUNK_SIZE * 3) / 2
    mockFetch.mockResolvedValueOnce(inworldFloat32Response(sampleCount))

    const cb = createCallbacks()
    const callOrder: string[] = []

    cb.onTTSChunk.mockImplementation(() => {
      callOrder.push('chunk')
    })
    cb.onSpeakingComplete.mockImplementation(() => {
      callOrder.push('speaking_complete')
    })

    await textToSpeechWithFallback('Test ordering', cb)

    // All chunk events should come before speaking_complete
    const completeIdx = callOrder.indexOf('speaking_complete')
    const lastChunkIdx = callOrder.lastIndexOf('chunk')

    expect(completeIdx).toBeGreaterThan(-1)
    expect(lastChunkIdx).toBeGreaterThan(-1)
    expect(completeIdx).toBeGreaterThan(lastChunkIdx)
  })

  // TEST 3: TTS failure falls back gracefully
  it('TTS failure falls back to Deepgram gracefully', async () => {
    // Inworld fails, Deepgram succeeds
    mockFetch
      .mockResolvedValueOnce(errorResp(500, 'Inworld unavailable'))
      .mockResolvedValueOnce(deepgramOK('fallback-audio-data'))

    const cb = createCallbacks()
    await textToSpeechWithFallback('Test fallback', cb)

    // Fallback Deepgram was attempted and delivered audio
    expect(cb.onTTSChunk).toHaveBeenCalled()
    const chunkArg = cb.onTTSChunk.mock.calls[0][0]
    expect(typeof chunkArg).toBe('string') // base64 string

    // No error sent to client
    expect(cb.onError).not.toHaveBeenCalled()

    // onSpeakingComplete still fired
    expect(cb.onSpeakingComplete).toHaveBeenCalled()
  })

  // TEST 4: Empty TTS response doesn't hang
  it("empty TTS response doesn't hang", async () => {
    const cb = createCallbacks()

    // Pass empty text — pipeline should complete, not hang
    await textToSpeechWithFallback('', cb)

    // Pipeline completes — state transitions to idle (onSpeakingComplete)
    expect(cb.onSpeakingComplete).toHaveBeenCalled()

    // No audio chunks (nothing to speak)
    expect(cb.onTTSChunk).not.toHaveBeenCalled()

    // Warning logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Empty text'),
    )
  })

  // TEST 5: Large response chunked correctly
  it('large response chunked correctly at TTS text level', async () => {
    // LLM response of ~5500 characters
    const longResponse =
      'The analysis reveals significant findings. '.repeat(125)

    const textChunks = chunkText(longResponse, 2000)
    expect(textChunks.length).toBe(Math.ceil(longResponse.length / 2000))

    // Mock: each TTS text chunk produces one audio response
    for (let i = 0; i < textChunks.length; i++) {
      mockFetch.mockResolvedValueOnce(inworldOKSized(TTS_CHUNK_SIZE))
    }

    const cb = createCallbacks()

    // Process each text chunk through TTS
    for (const chunk of textChunks) {
      await inworldTTS(chunk, cb)
    }

    // All TTS calls made (one per text chunk)
    expect(mockFetch).toHaveBeenCalledTimes(textChunks.length)

    // All resulting audio chunks delivered as base64 strings
    expect(cb.onTTSChunk).toHaveBeenCalledTimes(textChunks.length)
    for (const call of cb.onTTSChunk.mock.calls) {
      expect(typeof call[0]).toBe('string')
    }
  })
})

// ============================================================================
// AUDIO FORMAT CONVERSION — float32ToInt16Base64
// This is the critical path for all TTS delivery. Every audio chunk passes
// through this function. If it's wrong, the user hears silence or garbage.
// ============================================================================

describe('Audio Format Conversion — float32ToInt16Base64 (SA-042-03)', () => {

  it('converts known float32 samples to correct int16 values', () => {
    // Create a Float32Array with known values
    const float32 = new Float32Array([
      0.0,     // silence → 0
      1.0,     // max positive → 32767 (0x7FFF)
      -1.0,    // max negative → -32768 (0x8000)
      0.5,     // half positive → ~16383
      -0.5,    // half negative → ~-16384
      0.25,    // quarter → ~8191
    ])

    const float32Base64 = Buffer.from(float32.buffer).toString('base64')
    const result = float32ToInt16Base64(float32Base64)

    // Decode result back to Int16
    const resultBuffer = Buffer.from(result, 'base64')
    const int16 = new Int16Array(
      resultBuffer.buffer,
      resultBuffer.byteOffset,
      resultBuffer.length / 2,
    )

    // Same number of samples
    expect(int16.length).toBe(float32.length)

    // Silence → 0
    expect(int16[0]).toBe(0)

    // Max positive → 32767
    expect(int16[1]).toBe(32767)

    // Max negative → -32768
    expect(int16[2]).toBe(-32768)

    // 0.5 → ~16383 (0.5 * 0x7FFF = 16383.5)
    expect(int16[3]).toBeCloseTo(16383, -1)

    // -0.5 → ~-16384 (-0.5 * 0x8000 = -16384)
    expect(int16[4]).toBeCloseTo(-16384, -1)

    // 0.25 → ~8191 (0.25 * 0x7FFF = 8191.75)
    expect(int16[5]).toBeCloseTo(8191, -1)
  })

  it('clamps out-of-range values instead of wrapping', () => {
    // Values outside [-1.0, 1.0] must clamp, not wrap around
    const float32 = new Float32Array([
      1.5,     // over max → should clamp to 32767
      -1.5,    // under min → should clamp to -32768
      3.0,     // way over → still 32767
      -3.0,    // way under → still -32768
    ])

    const float32Base64 = Buffer.from(float32.buffer).toString('base64')
    const result = float32ToInt16Base64(float32Base64)
    const resultBuffer = Buffer.from(result, 'base64')
    const int16 = new Int16Array(
      resultBuffer.buffer,
      resultBuffer.byteOffset,
      resultBuffer.length / 2,
    )

    expect(int16[0]).toBe(32767)
    expect(int16[1]).toBe(-32768)
    expect(int16[2]).toBe(32767)
    expect(int16[3]).toBe(-32768)
  })

  it('preserves sample count across conversion', () => {
    // N float32 samples → exactly N int16 samples
    for (const count of [1, 100, 1000, 4800]) {
      const float32 = new Float32Array(count)
      for (let i = 0; i < count; i++) {
        float32[i] = Math.sin((2 * Math.PI * i) / count) * 0.8
      }

      const float32Base64 = Buffer.from(float32.buffer).toString('base64')
      const result = float32ToInt16Base64(float32Base64)
      const resultBuffer = Buffer.from(result, 'base64')
      const int16 = new Int16Array(
        resultBuffer.buffer,
        resultBuffer.byteOffset,
        resultBuffer.length / 2,
      )

      expect(int16.length).toBe(count)
    }
  })

  it('produces valid base64 output for any input size', () => {
    // The output must always be valid base64 that can decode
    for (const count of [0, 1, 7, 48, 4800]) {
      const float32 = new Float32Array(count)
      const float32Base64 = Buffer.from(float32.buffer).toString('base64')
      const result = float32ToInt16Base64(float32Base64)

      // Valid base64
      expect(typeof result).toBe('string')
      const decoded = Buffer.from(result, 'base64')
      expect(decoded.length).toBe(count * 2) // int16 = 2 bytes per sample
    }
  })
})

// ============================================================================
// EDGE CASES — failure modes that could cause audio delivery to hang or crash
// ============================================================================

describe('TTS Edge Cases (BUG-042 SA-042-03)', () => {

  it('both TTS providers fail — error propagated, pipeline completes', async () => {
    // Inworld fails, then Deepgram also fails
    mockFetch
      .mockResolvedValueOnce(errorResp(500, 'Inworld down'))
      .mockResolvedValueOnce(errorResp(503, 'Deepgram overloaded'))

    const cb = createCallbacks()
    await textToSpeechWithFallback('Both fail', cb)

    // Error IS sent to client (both providers exhausted)
    expect(cb.onError).toHaveBeenCalledTimes(1)
    expect(cb.onError.mock.calls[0][0]).toBeInstanceOf(Error)

    // No audio delivered
    expect(cb.onTTSChunk).not.toHaveBeenCalled()

    // Pipeline still completes — does NOT hang
    expect(cb.onSpeakingComplete).toHaveBeenCalled()
  })

  it('whitespace-only text treated as empty — no TTS attempt', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation()

    const cb = createCallbacks()
    await textToSpeechWithFallback('   \n\t  ', cb)

    // No fetch calls made (no TTS attempted)
    expect(mockFetch).not.toHaveBeenCalled()

    // Pipeline completes
    expect(cb.onSpeakingComplete).toHaveBeenCalled()
    expect(cb.onTTSChunk).not.toHaveBeenCalled()

    // Warning logged
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Empty text'),
    )

    warnSpy.mockRestore()
  })

  it('TTS response with no audioContent field throws and falls back', async () => {
    // Inworld returns 200 but missing audioContent field
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
        text: async () => JSON.stringify({ success: true }),
      })
      .mockResolvedValueOnce(deepgramOK('rescue-audio'))

    const cb = createCallbacks()
    await textToSpeechWithFallback('Missing field test', cb)

    // Deepgram fallback delivered audio
    expect(cb.onTTSChunk).toHaveBeenCalled()
    expect(cb.onError).not.toHaveBeenCalled()
    expect(cb.onSpeakingComplete).toHaveBeenCalled()
  })
})
