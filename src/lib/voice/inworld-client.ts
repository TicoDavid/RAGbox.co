/**
 * Inworld TTS Client
 *
 * Server-side text-to-speech synthesis via Inworld AI TTS API.
 * Uses Basic auth with base64 credential — NOT Bearer token.
 *
 * Endpoints:
 *   POST https://api.inworld.ai/tts/v1/voice         — single response
 *   POST https://api.inworld.ai/tts/v1/voice:stream   — NDJSON streaming
 *
 * Text exceeding 2000 chars is automatically chunked at sentence boundaries.
 *
 * NOTE: This replaces the old InworldClient that proxied through /api/voice/synthesize
 * (Deepgram Aura). Callers (e.g. useVoiceChat.ts) must be updated to use the new
 * API route that wraps this server-side client.
 */

import type { ResponseContext } from './types';

const INWORLD_TTS_URL = 'https://api.inworld.ai/tts/v1/voice';
const INWORLD_TTS_STREAM_URL = 'https://api.inworld.ai/tts/v1/voice:stream';
const MAX_CHARS_PER_REQUEST = 2000;
const MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_VOICE_ID = 'Ashley';
const DEFAULT_MODEL_ID = 'inworld-tts-1.5-max';

function getApiKey(): string {
  const key = process.env.INWORLD_API_KEY;
  if (!key) {
    throw new Error('INWORLD_API_KEY not configured');
  }
  return key;
}

/** Split text into chunks of at most maxChars, breaking at sentence/word boundaries. */
export function chunkText(text: string, maxChars: number = MAX_CHARS_PER_REQUEST): string[] {
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining);
      break;
    }

    const searchRegion = remaining.slice(0, maxChars);

    // Try to split at the last sentence-ending punctuation followed by a space
    const sentenceEnd = searchRegion.lastIndexOf('. ');
    const questionEnd = searchRegion.lastIndexOf('? ');
    const exclamEnd = searchRegion.lastIndexOf('! ');
    let splitIndex = Math.max(sentenceEnd, questionEnd, exclamEnd);

    if (splitIndex > 0) {
      splitIndex += 2; // include punctuation + space
    } else {
      // Fallback: split at last space
      splitIndex = searchRegion.lastIndexOf(' ');
    }

    if (splitIndex <= 0) {
      // Last resort: hard split
      splitIndex = maxChars;
    }

    chunks.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }

  return chunks.filter(c => c.length > 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

export interface InworldTTSClientOptions {
  voiceId?: string;
  modelId?: string;
  /** @internal Override base delay for tests. */
  baseDelayMs?: number;
}

export class InworldTTSClient {
  private readonly voiceId: string;
  private readonly modelId: string;
  private readonly baseDelayMs: number;

  constructor(options?: InworldTTSClientOptions) {
    this.voiceId = options?.voiceId ?? DEFAULT_VOICE_ID;
    this.modelId = options?.modelId ?? DEFAULT_MODEL_ID;
    this.baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  }

  /**
   * Synthesize text to audio via Inworld TTS API.
   * Automatically chunks text exceeding 2000 characters and concatenates results.
   */
  async synthesize(text: string, voiceId?: string): Promise<Buffer> {
    const resolvedVoice = voiceId ?? this.voiceId;
    const chunks = chunkText(text);

    const audioBuffers: Buffer[] = [];
    for (const chunk of chunks) {
      const buf = await this.synthesizeChunk(chunk, resolvedVoice);
      audioBuffers.push(buf);
    }

    return Buffer.concat(audioBuffers);
  }

  /**
   * Stream synthesized audio via Inworld TTS streaming endpoint.
   * Returns NDJSON with ttsOutputChunk containing base64 audio data.
   * Audio config: LINEAR16, 48000 Hz.
   */
  async *synthesizeStream(text: string, voiceId?: string): AsyncGenerator<Buffer> {
    const resolvedVoice = voiceId ?? this.voiceId;
    const chunks = chunkText(text);

    for (const chunk of chunks) {
      yield* this.streamChunk(chunk, resolvedVoice);
    }
  }

  private async synthesizeChunk(text: string, voiceId: string): Promise<Buffer> {
    const apiKey = getApiKey();

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const response = await fetch(INWORLD_TTS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${apiKey}`,
        },
        body: JSON.stringify({
          text,
          voiceId,
          modelId: this.modelId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return Buffer.from(data.audioContent, 'base64');
      }

      if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
        await sleep(this.baseDelayMs * Math.pow(2, attempt));
        continue;
      }

      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new Error(`Inworld TTS failed (${response.status}): ${errorBody}`);
    }

    throw new Error('Inworld TTS: max retries exceeded');
  }

  private async *streamChunk(text: string, voiceId: string): AsyncGenerator<Buffer> {
    const apiKey = getApiKey();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(INWORLD_TTS_STREAM_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${apiKey}`,
          },
          body: JSON.stringify({
            text,
            voiceId,
            modelId: this.modelId,
            audio_config: {
              audio_encoding: 'LINEAR16',
              sample_rate_hertz: 48000,
            },
          }),
        });

        if (response.ok) {
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body for streaming TTS');
          }

          const decoder = new TextDecoder();
          let lineBuf = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            lineBuf += decoder.decode(value, { stream: true });
            const lines = lineBuf.split('\n');
            lineBuf = lines.pop() ?? '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              const parsed = JSON.parse(trimmed);
              if (parsed.ttsOutputChunk?.audio) {
                yield Buffer.from(parsed.ttsOutputChunk.audio, 'base64');
              }
            }
          }

          // Flush remaining line buffer
          if (lineBuf.trim()) {
            const parsed = JSON.parse(lineBuf.trim());
            if (parsed.ttsOutputChunk?.audio) {
              yield Buffer.from(parsed.ttsOutputChunk.audio, 'base64');
            }
          }

          return;
        }

        if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
          await sleep(this.baseDelayMs * Math.pow(2, attempt));
          continue;
        }

        const errorBody = await response.text().catch(() => 'Unknown error');
        throw new Error(`Inworld TTS stream failed (${response.status}): ${errorBody}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < MAX_RETRIES) {
          await sleep(this.baseDelayMs * Math.pow(2, attempt));
          continue;
        }
      }
    }

    throw lastError ?? new Error('Inworld TTS stream: max retries exceeded');
  }
}

// ---------------------------------------------------------------------------
// Emotion-tag utility — used by useVoiceChat.ts for emotion-aware TTS input.
// Kept as a standalone export so callers don't depend on the TTS client class.
// ---------------------------------------------------------------------------

function getEmotionTag(context: ResponseContext): string {
  if (context.isError) return '[apologetic]';
  if (context.isGreeting) return '[warm]';
  if (context.isPrivilegeFiltered) return '[serious]';
  if (context.hasWarning) return '[concerned]';
  if (context.confidence < 0.85) return '[thoughtful]';
  return '[confident]';
}

export function prepareTextForTTS(text: string, context: ResponseContext): string {
  return `${getEmotionTag(context)} ${text}`;
}
