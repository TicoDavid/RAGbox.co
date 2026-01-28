import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    console.error('[Voice Token] DEEPGRAM_API_KEY not configured');
    return NextResponse.json(
      { error: 'Voice service not configured' },
      { status: 503 }
    );
  }

  try {
    // Validate key by checking projects endpoint
    const response = await fetch('https://api.deepgram.com/v1/projects', {
      method: 'GET',
      headers: {
        'Authorization': `Token ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Deepgram API error: ${response.status}`);
    }

    // Return key with expiration (MVP approach)
    // Production: Use Deepgram's temporary key API
    return NextResponse.json({
      key: apiKey,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    });
  } catch (error) {
    console.error('[Voice Token] Deepgram token error:', error);
    return NextResponse.json(
      { error: 'Failed to validate voice credentials' },
      { status: 500 }
    );
  }
}
