import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiKey = process.env.INWORLD_API_KEY;
  const defaultVoiceId = process.env.INWORLD_VOICE_ID || 'default';

  if (!apiKey) {
    return NextResponse.json(
      { error: 'TTS service not configured' },
      { status: 503 }
    );
  }

  try {
    const { text, voiceId } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    const response = await fetch('https://studio.inworld.ai/v1/tts/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice_id: voiceId || defaultVoiceId,
        output_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Inworld] TTS error:', error);
      return NextResponse.json(
        { error: 'TTS synthesis failed' },
        { status: response.status }
      );
    }

    const audioData = await response.arrayBuffer();

    return new NextResponse(audioData, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioData.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('[TTS] Route error:', error);
    return NextResponse.json(
      { error: 'TTS service error' },
      { status: 500 }
    );
  }
}
