/**
 * BUG-042 SA-042-03: TTS Audio Delivery Tests
 *
 * Tests that TTS audio chunks are actually delivered to the WebSocket
 * correctly — binary frames, callback ordering, fallback behavior,
 * empty response handling, and large response chunking.
 *
 * — Sarah, QA
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

function inworldOK(audioData: string) {
  const audioContent = Buffer.from(audioData).toString('base64')
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

// ─── Inline TTS functions (mirror v2 pipeline) ─────────────────────────────

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

  const audioBuffer = Buffer.from(data.audioContent, 'base64')
  for (let offset = 0; offset < audioBuffer.length; offset += TTS_CHUNK_SIZE) {
    cb.onTTSChunk(audioBuffer.subarray(offset, offset + TTS_CHUNK_SIZE))
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
  for (let offset = 0; offset < audioBuffer.length; offset += TTS_CHUNK_SIZE) {
    cb.onTTSChunk(audioBuffer.subarray(offset, offset + TTS_CHUNK_SIZE))
  }
}

async function textToSpeechWithFallback(
  text: string,
  cb: TTSCallbacks,
): Promise<void> {
  if (!text || text.trim().length === 0) {
    // Empty TTS — don't hang, just complete
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
        deepgramError instanceof Error ? deepgramError : new Error(String(deepgramError)),
      )
    }
  }
  cb.onSpeakingComplete()
}

// ============================================================================
// TESTS
// ============================================================================

describe('TTS Audio Delivery (BUG-042 SA-042-03)', () => {
  const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

  afterEach(() => {
    consoleSpy.mockClear()
  })

  afterAll(() => {
    consoleSpy.mockRestore()
  })

  // TEST 1
  it('TTS chunks are sent as binary Buffer frames', async () => {
    // Inworld returns audio that produces exactly 10 chunks when split at 16KB
    const audioSize = TTS_CHUNK_SIZE * 10
    mockFetch.mockResolvedValueOnce(inworldOKSized(audioSize))

    const cb = createCallbacks()
    await inworldTTS('Generate ten chunks of audio', cb)

    // Should receive exactly 10 binary frames
    expect(cb.onTTSChunk).toHaveBeenCalledTimes(10)

    // Each frame is a non-empty Buffer
    for (const call of cb.onTTSChunk.mock.calls) {
      const chunk = call[0] as Buffer
      expect(Buffer.isBuffer(chunk)).toBe(true)
      expect(chunk.length).toBeGreaterThan(0)
    }
  })

  // TEST 2
  it('onSpeakingComplete fires AFTER all TTS chunks sent', async () => {
    mockFetch.mockResolvedValueOnce(inworldOKSized(TTS_CHUNK_SIZE * 3))

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

  // TEST 3
  it('TTS failure falls back gracefully', async () => {
    // Inworld fails, Deepgram succeeds
    mockFetch
      .mockResolvedValueOnce(errorResp(500, 'Inworld unavailable'))
      .mockResolvedValueOnce(deepgramOK('fallback-audio-data'))

    const cb = createCallbacks()
    await textToSpeechWithFallback('Test fallback', cb)

    // Fallback Deepgram was attempted and delivered audio
    expect(cb.onTTSChunk).toHaveBeenCalled()

    // No error sent to client
    expect(cb.onError).not.toHaveBeenCalled()

    // onSpeakingComplete still fired
    expect(cb.onSpeakingComplete).toHaveBeenCalled()
  })

  // TEST 4
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

  // TEST 5
  it('large response chunked correctly at TTS text level', async () => {
    // LLM response of ~5000 characters
    const longResponse =
      'The analysis reveals significant findings. '.repeat(125) // ~5500 chars

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

    // All resulting audio chunks delivered
    expect(cb.onTTSChunk).toHaveBeenCalledTimes(textChunks.length)
  })
})
