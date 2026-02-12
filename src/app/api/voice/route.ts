import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createGeminiLiveSession, GeminiLiveSession, GeminiLiveConfig } from '@/lib/vertex/gemini-live-client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Valid Gemini voices
const VALID_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'] as const;
type GeminiVoice = typeof VALID_VOICES[number];

// Store active sessions (in production, use Redis or similar)
const activeSessions = new Map<string, GeminiLiveSession>();
const sessionVoices = new Map<string, GeminiVoice>();

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
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/voice
 *
 * SSE endpoint for receiving audio/text from Gemini
 * Query params:
 *   - voice: Puck | Charon | Kore | Fenrir | Aoede (default: Puck)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.email;

    // Get voice from query param or use stored preference
    const { searchParams } = new URL(request.url);
    const voiceParam = searchParams.get('voice') as GeminiVoice | null;
    const voice: GeminiVoice = voiceParam && VALID_VOICES.includes(voiceParam) ? voiceParam : (sessionVoices.get(userId) || 'Puck');

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
            voice: voice,
            onConnected: () => {
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
              sendEvent('error', { message: error.message });
            },
            onDisconnected: () => {
              activeSessions.delete(userId);
              sendEvent('disconnected', {});
              controller.close();
            },
          });

        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          sendEvent('error', { message });
          controller.close();
        }
      },

      cancel() {
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
