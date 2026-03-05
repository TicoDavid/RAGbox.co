/**
 * POST /api/voice/synthesize
 *
 * Server-side TTS synthesis via Inworld AI.
 * Accepts text (with optional emotion tags), returns raw audio bytes.
 *
 * Replaces the previous Deepgram Aura implementation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { InworldTTSClient } from '@/lib/voice/inworld-client';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

// Emotion tags prepended by prepareTextForTTS — strip before sending to Inworld
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

    const audioBuffer = await client.synthesize(cleanText, voiceId || undefined);
    const bytes = new Uint8Array(audioBuffer);

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': bytes.byteLength.toString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;

    if (message.includes('INWORLD_API_KEY')) {
      logger.error('[VOICE-TTS] INWORLD_API_KEY not configured on ragbox-app', {
        hint: 'Ensure INWORLD_API_KEY=ragbox-inworld-api-key:latest is in cloudbuild.yaml --set-secrets',
        hasEnvVar: !!process.env.INWORLD_API_KEY,
      });
      return NextResponse.json(
        { error: 'TTS service not configured' },
        { status: 503 }
      );
    }

    // Network / timeout errors
    if (message.includes('fetch failed') || message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')) {
      logger.error('[VOICE-TTS] Inworld API unreachable', { message, stack });
      return NextResponse.json(
        { error: 'TTS service temporarily unavailable' },
        { status: 503 }
      );
    }

    logger.error('[VOICE-TTS] Synthesis failed', { message, stack });
    return NextResponse.json(
      { error: 'TTS synthesis failed' },
      { status: 500 }
    );
  }
}
