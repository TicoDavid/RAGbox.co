/**
 * Text-to-Speech API using Google Cloud TTS
 *
 * POST /api/tts
 *
 * Converts text to natural-sounding speech using Google Cloud TTS
 * Returns audio as base64 encoded MP3
 */

import { NextRequest, NextResponse } from 'next/server';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const runtime = 'nodejs';

// Initialize TTS client
const ttsClient = new TextToSpeechClient();

// Available voices - Neural2 and WaveNet sound most natural
const VOICES = {
  // Neural2 voices (newest, most natural)
  'aria': { name: 'en-US-Neural2-F', gender: 'FEMALE' },
  'luke': { name: 'en-US-Neural2-D', gender: 'MALE' },
  'nova': { name: 'en-US-Neural2-C', gender: 'FEMALE' },
  'echo': { name: 'en-US-Neural2-A', gender: 'MALE' },
  'sage': { name: 'en-US-Neural2-H', gender: 'FEMALE' },
  // WaveNet voices (also very natural)
  'wavenet-a': { name: 'en-US-Wavenet-A', gender: 'MALE' },
  'wavenet-c': { name: 'en-US-Wavenet-C', gender: 'FEMALE' },
  'wavenet-d': { name: 'en-US-Wavenet-D', gender: 'MALE' },
  'wavenet-f': { name: 'en-US-Wavenet-F', gender: 'FEMALE' },
} as const;

type VoiceId = keyof typeof VOICES;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { text, voice = 'aria', speakingRate = 1.0, pitch = 0 } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Limit text length
    if (text.length > 5000) {
      return NextResponse.json({ error: 'Text too long (max 5000 chars)' }, { status: 400 });
    }

    // Get voice config
    const voiceConfig = VOICES[voice as VoiceId] || VOICES['aria'];

    // Synthesize speech
    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: 'en-US',
        name: voiceConfig.name,
        ssmlGender: voiceConfig.gender as 'MALE' | 'FEMALE',
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: Math.max(0.25, Math.min(4.0, speakingRate)),
        pitch: Math.max(-20.0, Math.min(20.0, pitch)),
        effectsProfileId: ['small-bluetooth-speaker-class-device'], // Optimized for voice
      },
    });

    if (!response.audioContent) {
      throw new Error('No audio content returned');
    }

    // Convert to base64
    const audioBase64 = Buffer.from(response.audioContent as Uint8Array).toString('base64');

    return NextResponse.json({
      success: true,
      audio: audioBase64,
      format: 'mp3',
      voice: voiceConfig.name,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/tts/voices
 *
 * List available voices
 */
export async function GET() {
  return NextResponse.json({
    voices: Object.entries(VOICES).map(([id, config]) => ({
      id,
      name: config.name,
      gender: config.gender,
    })),
  });
}
