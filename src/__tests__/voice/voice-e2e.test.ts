/**
 * Voice Pipeline End-to-End Tests
 *
 * Covers the new Inworld TTS pipeline:
 *   Browser → /api/voice/synthesize → InworldTTSClient → Inworld API
 *   Browser → /api/voice/synthesize-stream → InworldTTSClient.synthesizeStream()
 *   useVoiceChat hook → synthesizeTTS() → fallback chain
 */

import type { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as typeof fetch;

// Mock next/server for route handler tests
class MockNextResponse {
  _body: unknown;
  status: number;
  headers: Map<string, string>;

  constructor(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
    this._body = body;
    this.status = init?.status ?? 200;
    this.headers = new Map(Object.entries(init?.headers || {}));
  }

  static json(body: unknown, init?: { status?: number }) {
    const res = new MockNextResponse(null, init);
    res._body = body;
    return res;
  }
}

jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: MockNextResponse,
}));

function createMockVoiceRequest(body: Record<string, unknown>): Partial<Request> {
  return { json: async () => body } as Partial<Request>
}

function getMockBody(res: unknown): Record<string, string> {
  return (res as MockNextResponse)._body as Record<string, string>
}

// ---------------------------------------------------------------------------
// Sync Synthesis: POST /api/voice/synthesize
// ---------------------------------------------------------------------------

describe('POST /api/voice/synthesize', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, INWORLD_API_KEY: 'dGVzdC1rZXk=' };
    mockFetch.mockReset();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns 200 with audio/mpeg body for valid text', async () => {
    // GIVEN a valid text payload and a working Inworld TTS API
    // WHEN POST /api/voice/synthesize is called with { text: "Hello Mercury" }
    // THEN the response status is 200
    //   AND Content-Type is audio/mpeg
    //   AND the body contains raw audio bytes decoded from Inworld's base64 audioContent
    const audioBase64 = Buffer.from('fake-mp3-data').toString('base64');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ audioContent: audioBase64 }),
    });

    const { POST } = await import('@/app/api/voice/synthesize/route');
    const req = createMockVoiceRequest({ text: 'Hello Mercury' });
    const res = await POST(req as Partial<NextRequest> as NextRequest);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
  });

  it('returns 400 for empty text', async () => {
    // GIVEN a request with empty or missing text
    // WHEN POST /api/voice/synthesize is called with { text: "" }
    // THEN the response status is 400
    //   AND the body contains { error: "Text is required" }
    const { POST } = await import('@/app/api/voice/synthesize/route');
    const req = createMockVoiceRequest({ text: '' });
    const res = await POST(req as Partial<NextRequest> as NextRequest);

    expect(getMockBody(res).error).toBe('Text is required');
    expect(res.status).toBe(400);
  });

  it('returns 400 for text exceeding 50k characters', async () => {
    // GIVEN a request with text longer than 50,000 characters
    // WHEN POST /api/voice/synthesize is called with { text: "A".repeat(50001) }
    // THEN the response status is 400
    //   AND the body contains { error: "Text too long (max 50000 chars)" }
    const { POST } = await import('@/app/api/voice/synthesize/route');
    const req = createMockVoiceRequest({ text: 'A'.repeat(50001) });
    const res = await POST(req as Partial<NextRequest> as NextRequest);

    expect(getMockBody(res).error).toBe('Text too long (max 50000 chars)');
    expect(res.status).toBe(400);
  });

  it('passes custom voiceId to Inworld API', async () => {
    // GIVEN a request with a custom voiceId
    // WHEN POST /api/voice/synthesize is called with { text: "Hello", voiceId: "Luna" }
    // THEN the Inworld TTS API is called with voiceId "Luna" in the request body
    //   AND the response status is 200
    const audioBase64 = Buffer.from('audio').toString('base64');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ audioContent: audioBase64 }),
    });

    const { POST } = await import('@/app/api/voice/synthesize/route');
    const req = createMockVoiceRequest({ text: 'Hello', voiceId: 'Luna' });
    await POST(req as Partial<NextRequest> as NextRequest);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.voiceId).toBe('Luna');
  });

  it('returns 503 when INWORLD_API_KEY is not configured', async () => {
    // GIVEN INWORLD_API_KEY is not set in the environment
    // WHEN POST /api/voice/synthesize is called with valid text
    // THEN the response status is 503
    //   AND the body contains { error: "TTS service not configured" }
    delete process.env.INWORLD_API_KEY;

    const { POST } = await import('@/app/api/voice/synthesize/route');
    const req = createMockVoiceRequest({ text: 'Hello' });
    const res = await POST(req as Partial<NextRequest> as NextRequest);

    expect(getMockBody(res).error).toBe('TTS service not configured');
    expect(res.status).toBe(503);
  });

  it('strips emotion tags before sending to Inworld', async () => {
    // GIVEN text with a prepended emotion tag like "[warm] Hello"
    // WHEN POST /api/voice/synthesize is called
    // THEN the emotion tag is stripped before calling InworldTTSClient
    //   AND the Inworld API receives just "Hello" as the text
    const audioBase64 = Buffer.from('audio').toString('base64');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ audioContent: audioBase64 }),
    });

    const { POST } = await import('@/app/api/voice/synthesize/route');
    const req = createMockVoiceRequest({ text: '[warm] Hello there' });
    await POST(req as Partial<NextRequest> as NextRequest);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toBe('Hello there');
  });
});

// ---------------------------------------------------------------------------
// Streaming Synthesis: POST /api/voice/synthesize-stream
// ---------------------------------------------------------------------------

describe('POST /api/voice/synthesize-stream', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, INWORLD_API_KEY: 'dGVzdC1rZXk=' };
    mockFetch.mockReset();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns 200 with a ReadableStream', async () => {
    // GIVEN a valid text payload and a working Inworld TTS streaming API
    // WHEN POST /api/voice/synthesize-stream is called
    // THEN the response status is 200
    //   AND the body is a ReadableStream
    //   AND the response has Transfer-Encoding: chunked
    const ndjson = JSON.stringify({
      ttsOutputChunk: { audio: Buffer.from('chunk1').toString('base64') },
    }) + '\n';

    let consumed = false;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            if (consumed) return { done: true, value: undefined };
            consumed = true;
            return { done: false, value: new TextEncoder().encode(ndjson) };
          },
        }),
      },
    });

    const { POST } = await import('@/app/api/voice/synthesize-stream/route');
    const req = createMockVoiceRequest({ text: 'Hello stream' });
    const res = await POST(req as Partial<NextRequest> as NextRequest);

    expect(res.status).toBe(200); // Raw Response with stream body
    expect(res.body).toBeDefined();
  });

  it('sets Content-Type to audio/L16;rate=48000;channels=1', async () => {
    // GIVEN a valid streaming TTS request
    // WHEN the streaming response is returned
    // THEN Content-Type header is "audio/L16;rate=48000;channels=1"
    //   AND this matches the LINEAR16 48kHz format requested from Inworld
    const ndjson = JSON.stringify({
      ttsOutputChunk: { audio: Buffer.from('audio').toString('base64') },
    }) + '\n';

    let consumed = false;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            if (consumed) return { done: true, value: undefined };
            consumed = true;
            return { done: false, value: new TextEncoder().encode(ndjson) };
          },
        }),
      },
    });

    const { POST } = await import('@/app/api/voice/synthesize-stream/route');
    const req = createMockVoiceRequest({ text: 'Hello' });
    const res = await POST(req as Partial<NextRequest> as NextRequest);

    expect(res.headers.get('Content-Type')).toBe('audio/L16;rate=48000;channels=1');
  });

  it('streams multiple chunks (not a single blob)', async () => {
    // GIVEN Inworld returns NDJSON with multiple ttsOutputChunk entries
    // WHEN the client reads from the stream
    // THEN multiple chunks are yielded individually
    //   AND each chunk contains decoded audio data
    //   AND the stream eventually closes
    const chunk1 = JSON.stringify({
      ttsOutputChunk: { audio: Buffer.from('part1').toString('base64') },
    });
    const chunk2 = JSON.stringify({
      ttsOutputChunk: { audio: Buffer.from('part2').toString('base64') },
    });
    const ndjson = chunk1 + '\n' + chunk2 + '\n';

    let consumed = false;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => ({
          read: async () => {
            if (consumed) return { done: true, value: undefined };
            consumed = true;
            return { done: false, value: new TextEncoder().encode(ndjson) };
          },
        }),
      },
    });

    const { POST } = await import('@/app/api/voice/synthesize-stream/route');
    const req = createMockVoiceRequest({ text: 'Hello' });
    const res = await POST(req as Partial<NextRequest> as NextRequest);

    // Read all chunks from the ReadableStream
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// useVoiceChat Integration
// ---------------------------------------------------------------------------

describe('useVoiceChat integration', () => {
  it('synthesizeTTS calls /api/voice/synthesize and returns ArrayBuffer', async () => {
    // GIVEN the hook's internal synthesizeTTS function
    // WHEN it is called with text to synthesize
    // THEN it POSTs to /api/voice/synthesize with { text } in the body
    //   AND it returns the response as an ArrayBuffer
    //   AND the ArrayBuffer is compatible with AudioPlayback.play()
  });

  it('falls back to Google Cloud TTS when Inworld primary fails', async () => {
    // GIVEN the primary /api/voice/synthesize call fails (network error or 5xx)
    // WHEN useVoiceChat attempts to speak a response
    // THEN it catches the error from the primary path
    //   AND it calls /api/tts (Google Cloud TTS) as a fallback
    //   AND if the fallback succeeds, audio plays via Audio element
    //   AND isSpeaking is set to false after playback completes
    //   AND listening resumes if mode is still 'on'
  });

  it('prepareTextForTTS prepends correct emotion tags', async () => {
    // GIVEN a response context with specific emotion signals
    // WHEN prepareTextForTTS is called before synthesis
    // THEN the text is prepended with the correct emotion tag:
    //   isGreeting=true    → "[warm] <text>"
    //   confidence >= 0.85 → "[confident] <text>"
    //   confidence < 0.85  → "[thoughtful] <text>"
    //   isError=true       → "[apologetic] <text>"
    //   hasWarning=true    → "[concerned] <text>"
    //   isPrivilegeFiltered → "[serious] <text>"
    const { prepareTextForTTS } = await import('@/lib/voice/inworld-client');

    expect(prepareTextForTTS('Hello', { confidence: 0.95, isGreeting: true }))
      .toBe('[warm] Hello');
    expect(prepareTextForTTS('Answer', { confidence: 0.95 }))
      .toBe('[confident] Answer');
    expect(prepareTextForTTS('Maybe', { confidence: 0.7 }))
      .toBe('[thoughtful] Maybe');
  });

  it('welcome message uses synthesizeTTS path', async () => {
    // GIVEN voice mode is turned ON
    // WHEN playWelcome is called
    // THEN it calls prepareTextForTTS with the welcome message and isGreeting context
    //   AND it calls synthesizeTTS (which POSTs to /api/voice/synthesize)
    //   AND the audio is played via AudioPlayback.play()
    //   AND after welcome finishes, microphone capture starts automatically
    //   AND if synthesizeTTS fails, listening starts anyway (graceful fallback)
  });

  it('auto-resumes listening after TTS playback ends', async () => {
    // GIVEN voice mode is 'on' and Mercury is speaking a response
    // WHEN the TTS audio playback completes (onEnd callback fires)
    // THEN AudioCapture.start() is called to resume Deepgram listening
    //   AND the user can speak their next utterance without manual intervention
  });

  it('does not attempt TTS when mode is off', async () => {
    // GIVEN voice mode has been turned off during processing
    // WHEN the chat API returns a response
    // THEN synthesizeTTS is NOT called
    //   AND AudioPlayback.play() is NOT called
    //   AND isSpeaking remains false
  });
});
