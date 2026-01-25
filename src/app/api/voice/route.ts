import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createGeminiLiveSession, GeminiLiveSession } from '@/lib/vertex/gemini-live-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Store active sessions (in production, use Redis or similar)
const activeSessions = new Map<string, GeminiLiveSession>();

/**
 * POST /api/voice
 *
 * Start a new voice session or send audio to existing session
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, sessionId, audioData, text } = body;

    const userId = session.user.email;

    switch (action) {
      case 'start': {
        // Clean up any existing session
        const existingSession = activeSessions.get(userId);
        if (existingSession) {
          existingSession.close();
          activeSessions.delete(userId);
        }

        console.log(`[Voice API] Starting new session for ${userId}`);

        // Create new session - but we need a way to stream responses back
        // For this, we'll return immediately and use SSE for responses
        return NextResponse.json({
          success: true,
          message: 'Use /api/voice/stream for SSE connection',
          sessionId: userId,
        });
      }

      case 'audio': {
        const liveSession = activeSessions.get(userId);
        if (!liveSession || !liveSession.isConnected()) {
          return NextResponse.json({ error: 'No active session' }, { status: 400 });
        }

        liveSession.sendAudio(audioData);
        return NextResponse.json({ success: true });
      }

      case 'text': {
        const liveSession = activeSessions.get(userId);
        if (!liveSession || !liveSession.isConnected()) {
          return NextResponse.json({ error: 'No active session' }, { status: 400 });
        }

        liveSession.sendText(text);
        return NextResponse.json({ success: true });
      }

      case 'interrupt': {
        const liveSession = activeSessions.get(userId);
        if (liveSession) {
          liveSession.interrupt();
        }
        return NextResponse.json({ success: true });
      }

      case 'stop': {
        const liveSession = activeSessions.get(userId);
        if (liveSession) {
          liveSession.close();
          activeSessions.delete(userId);
        }
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[Voice API] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/voice
 *
 * SSE endpoint for receiving audio/text from Gemini
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.email;
    console.log(`[Voice API] SSE connection requested for ${userId}`);

    // Create SSE stream
    const encoder = new TextEncoder();
    let liveSession: GeminiLiveSession | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Create Gemini Live session
          liveSession = await createGeminiLiveSession({
            voice: 'Puck',
            onConnected: () => {
              console.log(`[Voice API] Gemini session connected for ${userId}`);
              activeSessions.set(userId, liveSession!);
              sendEvent('connected', { sessionId: userId });
            },
            onAudioData: (audioBase64) => {
              sendEvent('audio', { data: audioBase64 });
            },
            onTextData: (text) => {
              sendEvent('text', { content: text });
            },
            onTurnComplete: () => {
              sendEvent('turnComplete', {});
            },
            onInterrupted: () => {
              sendEvent('interrupted', {});
            },
            onError: (error) => {
              console.error(`[Voice API] Gemini error for ${userId}:`, error);
              sendEvent('error', { message: error.message });
            },
            onDisconnected: () => {
              console.log(`[Voice API] Gemini session disconnected for ${userId}`);
              activeSessions.delete(userId);
              sendEvent('disconnected', {});
              controller.close();
            },
          });

        } catch (error) {
          console.error(`[Voice API] Failed to create session for ${userId}:`, error);
          const message = error instanceof Error ? error.message : 'Unknown error';
          sendEvent('error', { message });
          controller.close();
        }
      },

      cancel() {
        console.log(`[Voice API] SSE connection cancelled for ${userId}`);
        if (liveSession) {
          liveSession.close();
          activeSessions.delete(userId);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[Voice API] SSE Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
