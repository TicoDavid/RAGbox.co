/**
 * POST /api/voice/synthesize-stream
 *
 * Streaming TTS synthesis via Inworld AI.
 * Returns chunked audio as a ReadableStream (LINEAR16, 48 kHz, mono).
 *
 * The client can pipe this directly into an AudioWorklet or
 * buffer chunks for sequential playback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { InworldTTSClient } from '@/lib/voice/inworld-client';

export const runtime = 'nodejs';

const EMOTION_TAG_RE = /^\[(?:warm|confident|thoughtful|serious|concerned|apologetic|neutral)\]\s*/i;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voiceId, modelId } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    if (text.length > 50000) {
      return NextResponse.json(
        { error: 'Text too long (max 50000 chars)' },
        { status: 400 }
      );
    }

    const cleanText = text.replace(EMOTION_TAG_RE, '');

    const client = new InworldTTSClient({
      ...(modelId ? { modelId } : {}),
    });

    const generator = client.synthesizeStream(cleanText, voiceId || undefined);

    const stream = new ReadableStream({
      async pull(controller) {
        try {
          const { done, value } = await generator.next();
          if (done) {
            controller.close();
            return;
          }
          controller.enqueue(new Uint8Array(value));
        } catch (error) {
          controller.error(error);
        }
      },
      cancel() {
        generator.return(undefined as unknown as Buffer);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'audio/L16;rate=48000;channels=1',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('INWORLD_API_KEY')) {
      return NextResponse.json(
        { error: 'TTS service not configured' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'TTS streaming failed' },
      { status: 500 }
    );
  }
}
