import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Voice service not configured' },
      { status: 503 }
    );
  }

  try {
    // Step 1: Get project ID from Deepgram
    const projectsRes = await fetch('https://api.deepgram.com/v1/projects', {
      method: 'GET',
      headers: { 'Authorization': `Token ${apiKey}` },
    });

    if (!projectsRes.ok) {
      throw new Error(`Deepgram projects API error: ${projectsRes.status}`);
    }

    const projectsData = await projectsRes.json();
    const projectId = projectsData.projects?.[0]?.project_id;

    if (!projectId) {
      throw new Error('No Deepgram project found');
    }

    // Step 2: Create a temporary key with 30-second TTL
    const tempKeyRes = await fetch(
      `https://api.deepgram.com/v1/manage/projects/${projectId}/keys`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          comment: 'RAGbox browser session',
          scopes: ['usage:write'],
          time_to_live_in_seconds: 30,
        }),
      }
    );

    if (!tempKeyRes.ok) {
      throw new Error(`Deepgram key creation failed: ${tempKeyRes.status}`);
    }

    const tempKeyData = await tempKeyRes.json();

    return NextResponse.json({
      key: tempKeyData.key,
      expiresAt: new Date(Date.now() + 30000).toISOString(),
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to create voice session' },
      { status: 500 }
    );
  }
}
