import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const deepgramKey = process.env.DEEPGRAM_API_KEY;

  if (!deepgramKey) {
    return NextResponse.json(
      { error: 'TTS service not configured' },
      { status: 503 }
    );
  }

  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Strip emotion tags before sending to Deepgram TTS
    const cleanText = text.replace(/^\[(?:warm|confident|thoughtful|serious|concerned|apologetic|neutral)\]\s*/i, '');

    // Deepgram Aura TTS
    const model = process.env.DEEPGRAM_TTS_MODEL || 'aura-asteria-en';
    const response = await fetch(
      `https://api.deepgram.com/v1/speak?model=${model}&encoding=mp3`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: cleanText }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Deepgram TTS] Error:', response.status, error);
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
