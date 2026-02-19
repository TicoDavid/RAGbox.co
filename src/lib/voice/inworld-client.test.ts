import { InworldTTSClient, chunkText, prepareTextForTTS } from './inworld-client';

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// Helper: build a successful TTS response
function okResponse(audioText: string) {
  const audioContent = Buffer.from(audioText).toString('base64');
  return {
    ok: true,
    status: 200,
    json: async () => ({ audioContent }),
  };
}

// Helper: build an error response
function errorResponse(status: number, body = 'error') {
  return {
    ok: false,
    status,
    text: async () => body,
    json: async () => ({ error: body }),
  };
}

describe('InworldTTSClient', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, INWORLD_API_KEY: 'dGVzdC1rZXk=' };
    mockFetch.mockReset();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  // Use baseDelayMs: 1 so retry tests don't sleep for real
  function makeClient() {
    return new InworldTTSClient({ baseDelayMs: 1 });
  }

  // -----------------------------------------------------------------------
  // Successful synthesis
  // -----------------------------------------------------------------------
  describe('synthesize — success', () => {
    it('returns a Buffer with decoded audio content', async () => {
      mockFetch.mockResolvedValueOnce(okResponse('fake-audio'));

      const result = await makeClient().synthesize('Hello world');

      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('fake-audio');
    });

    it('calls the correct endpoint', async () => {
      mockFetch.mockResolvedValueOnce(okResponse('audio'));

      await makeClient().synthesize('Test');

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://api.inworld.ai/tts/v1/voice'
      );
    });

    it('sends voiceId, modelId, and text in request body', async () => {
      mockFetch.mockResolvedValueOnce(okResponse('audio'));

      await makeClient().synthesize('Hello', 'Luna');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual({
        text: 'Hello',
        voiceId: 'Luna',
        modelId: 'inworld-tts-1.5-max',
      });
    });

    it('defaults voiceId to "Ashley"', async () => {
      mockFetch.mockResolvedValueOnce(okResponse('audio'));

      await makeClient().synthesize('Test');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.voiceId).toBe('Ashley');
    });

    it('allows overriding modelId via constructor', async () => {
      mockFetch.mockResolvedValueOnce(okResponse('audio'));

      const client = new InworldTTSClient({
        modelId: 'inworld-tts-1.5-mini',
        baseDelayMs: 1,
      });
      await client.synthesize('Test');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.modelId).toBe('inworld-tts-1.5-mini');
    });
  });

  // -----------------------------------------------------------------------
  // Auth header format
  // -----------------------------------------------------------------------
  describe('auth header', () => {
    it('uses "Basic" scheme, NOT "Bearer"', async () => {
      mockFetch.mockResolvedValueOnce(okResponse('audio'));

      await makeClient().synthesize('Test');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toMatch(/^Basic /);
      expect(headers['Authorization']).not.toMatch(/^Bearer /);
    });

    it('includes the INWORLD_API_KEY value after "Basic "', async () => {
      mockFetch.mockResolvedValueOnce(okResponse('audio'));

      await makeClient().synthesize('Test');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toBe('Basic dGVzdC1rZXk=');
    });

    it('throws when INWORLD_API_KEY is missing', async () => {
      delete process.env.INWORLD_API_KEY;

      await expect(makeClient().synthesize('Test')).rejects.toThrow(
        'INWORLD_API_KEY not configured'
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Text chunking
  // -----------------------------------------------------------------------
  describe('chunkText', () => {
    it('returns single chunk when text is under limit', () => {
      expect(chunkText('Hello world', 2000)).toEqual(['Hello world']);
    });

    it('splits text exceeding maxChars into multiple chunks', () => {
      const text = 'A'.repeat(1500) + '. ' + 'B'.repeat(1500);
      const chunks = chunkText(text, 2000);

      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      }
    });

    it('prefers splitting at sentence boundaries', () => {
      const text = 'First sentence here. Second sentence here. Third sentence here.';
      const chunks = chunkText(text, 35);

      // Should split at ". " boundaries
      expect(chunks[0]).toBe('First sentence here.');
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('splits at question and exclamation marks', () => {
      const text = 'Is this correct? Yes it is! And more text follows for sure.';
      const chunks = chunkText(text, 30);

      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(30);
      }
    });

    it('falls back to word boundary when no sentence end found', () => {
      const text = 'word '.repeat(500).trim(); // 2499 chars, no periods
      const chunks = chunkText(text, 2000);

      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(2000);
      }
      // Reassembled chunks should reconstruct the original words
      const reassembled = chunks.join(' ');
      expect(reassembled.split(/\s+/).every(w => w === 'word')).toBe(true);
    });

    it('hard-splits when there are no spaces', () => {
      const text = 'A'.repeat(5000);
      const chunks = chunkText(text, 2000);

      expect(chunks.length).toBe(3); // 2000 + 2000 + 1000
      expect(chunks[0].length).toBe(2000);
      expect(chunks[1].length).toBe(2000);
      expect(chunks[2].length).toBe(1000);
    });
  });

  describe('synthesize — chunking integration', () => {
    it('makes one fetch call for short text', async () => {
      mockFetch.mockResolvedValueOnce(okResponse('audio'));

      await makeClient().synthesize('Short text');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('makes multiple fetch calls for text >2000 chars', async () => {
      mockFetch.mockResolvedValue(okResponse('chunk'));

      const longText = 'A'.repeat(1000) + '. ' + 'B'.repeat(1000) + '. ' + 'C'.repeat(800);
      await makeClient().synthesize(longText);

      expect(mockFetch.mock.calls.length).toBeGreaterThan(1);

      // Each request body text must be <= 2000 chars
      for (const call of mockFetch.mock.calls) {
        const body = JSON.parse(call[1].body);
        expect(body.text.length).toBeLessThanOrEqual(2000);
      }
    });

    it('concatenates audio from all chunks', async () => {
      let callIdx = 0;
      mockFetch.mockImplementation(async () => {
        const label = callIdx === 0 ? 'part1' : 'part2';
        callIdx++;
        return okResponse(label);
      });

      const longText = 'A'.repeat(1500) + '. ' + 'B'.repeat(1500);
      const result = await makeClient().synthesize(longText);

      expect(result.toString()).toBe('part1part2');
    });
  });

  // -----------------------------------------------------------------------
  // Retry logic
  // -----------------------------------------------------------------------
  describe('retry logic', () => {
    it('retries on 429 (rate limit) and succeeds', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(429, 'rate limited'))
        .mockResolvedValueOnce(okResponse('audio'));

      const result = await makeClient().synthesize('Test');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe('audio');
    });

    it('retries on 500 (server error) and succeeds', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(500, 'internal error'))
        .mockResolvedValueOnce(okResponse('audio'));

      const result = await makeClient().synthesize('Test');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.toString()).toBe('audio');
    });

    it('retries on 503 (unavailable) and succeeds', async () => {
      mockFetch
        .mockResolvedValueOnce(errorResponse(503, 'unavailable'))
        .mockResolvedValueOnce(errorResponse(502, 'bad gateway'))
        .mockResolvedValueOnce(okResponse('audio'));

      const result = await makeClient().synthesize('Test');

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.toString()).toBe('audio');
    });

    it('throws after exhausting all 3 retries (4 total attempts)', async () => {
      mockFetch.mockResolvedValue(errorResponse(500, 'persistent failure'));

      await expect(makeClient().synthesize('Test')).rejects.toThrow(
        'Inworld TTS failed (500): persistent failure'
      );

      // 1 initial + 3 retries = 4
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('does NOT retry on 400 (client error)', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(400, 'bad request'));

      await expect(makeClient().synthesize('Test')).rejects.toThrow(
        'Inworld TTS failed (400): bad request'
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry on 401 (unauthorized)', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401, 'unauthorized'));

      await expect(makeClient().synthesize('Test')).rejects.toThrow(
        'Inworld TTS failed (401): unauthorized'
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry on 403 (forbidden)', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403, 'forbidden'));

      await expect(makeClient().synthesize('Test')).rejects.toThrow(
        'Inworld TTS failed (403): forbidden'
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // synthesizeStream
  // -----------------------------------------------------------------------
  describe('synthesizeStream', () => {
    function makeStreamResponse(chunks: string[]) {
      const ndjson = chunks
        .map(c => JSON.stringify({ ttsOutputChunk: { audio: Buffer.from(c).toString('base64') } }))
        .join('\n') + '\n';

      let consumed = false;
      return {
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: async () => {
              if (consumed) return { done: true, value: undefined };
              consumed = true;
              return { done: false, value: new TextEncoder().encode(ndjson) };
            },
          }),
        },
      };
    }

    it('yields audio buffers from NDJSON stream', async () => {
      mockFetch.mockResolvedValueOnce(makeStreamResponse(['audio1', 'audio2']));

      const client = makeClient();
      const buffers: Buffer[] = [];

      for await (const buf of client.synthesizeStream('Test')) {
        buffers.push(buf);
      }

      expect(buffers).toHaveLength(2);
      expect(buffers[0].toString()).toBe('audio1');
      expect(buffers[1].toString()).toBe('audio2');
    });

    it('calls the streaming endpoint', async () => {
      mockFetch.mockResolvedValueOnce(makeStreamResponse(['audio']));

      const client = makeClient();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of client.synthesizeStream('Test')) {
        // drain
      }

      expect(mockFetch.mock.calls[0][0]).toBe(
        'https://api.inworld.ai/tts/v1/voice:stream'
      );
    });

    it('includes audio_config in stream request body', async () => {
      mockFetch.mockResolvedValueOnce(makeStreamResponse(['audio']));

      const client = makeClient();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of client.synthesizeStream('Test')) {
        // drain
      }

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.audio_config).toEqual({
        audio_encoding: 'LINEAR16',
        sample_rate_hertz: 48000,
      });
    });

    it('uses Basic auth for streaming endpoint', async () => {
      mockFetch.mockResolvedValueOnce(makeStreamResponse(['audio']));

      const client = makeClient();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of client.synthesizeStream('Test')) {
        // drain
      }

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Authorization']).toMatch(/^Basic /);
    });
  });

  // -----------------------------------------------------------------------
  // prepareTextForTTS (backward-compat utility)
  // -----------------------------------------------------------------------
  describe('prepareTextForTTS', () => {
    it('prepends [warm] for greetings', () => {
      expect(prepareTextForTTS('Hello!', { confidence: 0.95, isGreeting: true }))
        .toBe('[warm] Hello!');
    });

    it('prepends [confident] for high-confidence responses', () => {
      expect(prepareTextForTTS('The answer is yes.', { confidence: 0.95 }))
        .toBe('[confident] The answer is yes.');
    });

    it('prepends [thoughtful] for low-confidence responses', () => {
      expect(prepareTextForTTS('I think so.', { confidence: 0.7 }))
        .toBe('[thoughtful] I think so.');
    });

    it('prepends [apologetic] for errors', () => {
      expect(prepareTextForTTS('Something went wrong.', { confidence: 0.9, isError: true }))
        .toBe('[apologetic] Something went wrong.');
    });

    it('prepends [serious] for privilege-filtered responses', () => {
      expect(prepareTextForTTS('Redacted.', { confidence: 0.9, isPrivilegeFiltered: true }))
        .toBe('[serious] Redacted.');
    });

    it('prepends [concerned] for warnings', () => {
      expect(prepareTextForTTS('Be careful.', { confidence: 0.9, hasWarning: true }))
        .toBe('[concerned] Be careful.');
    });
  });
});
