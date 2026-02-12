import { GoogleAuth } from 'google-auth-library';
import WebSocket from 'ws';

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'ragbox-sovereign-prod';
// Gemini Live API is only available in specific regions - use us-central1
const LIVE_API_LOCATION = process.env.GEMINI_LIVE_LOCATION || 'us-central1';
// Models supported in Live API: gemini-2.0-flash-live-001, gemini-2.0-flash-live-preview-04-09
const LIVE_MODEL = 'gemini-2.0-flash-live-001';

// Gemini Live API WebSocket endpoint via Vertex AI
const GEMINI_LIVE_URL = `wss://${LIVE_API_LOCATION}-aiplatform.googleapis.com/ws/google.cloud.aiplatform.v1beta1.LlmBidiService/BidiGenerateContent`;

const SYSTEM_INSTRUCTION = `You are Mercury, the AI voice assistant for RAGbox - a sovereign document intelligence platform.

Key traits:
- Speak naturally and conversationally
- Be concise - this is voice, not text
- Professional yet approachable
- Security-conscious when discussing documents
- If asked about documents, mention that document analysis requires uploading files first

Keep responses brief and clear for voice interaction.`;

export interface GeminiLiveConfig {
  voice?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede';
  systemInstruction?: string;
  onAudioData?: (audioData: string) => void;
  onTextData?: (text: string) => void;
  onTurnComplete?: () => void;
  onError?: (error: Error) => void;
  onInterrupted?: () => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export interface GeminiLiveSession {
  sendAudio: (audioBase64: string) => void;
  sendText: (text: string) => void;
  interrupt: () => void;
  close: () => void;
  isConnected: () => boolean;
}

/**
 * Create a Gemini Live API session for real-time voice chat
 */
export async function createGeminiLiveSession(config: GeminiLiveConfig): Promise<GeminiLiveSession> {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();

  if (!accessToken.token) {
    throw new Error('Failed to get access token');
  }

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(GEMINI_LIVE_URL, {
      headers: {
        Authorization: `Bearer ${accessToken.token}`,
      },
    });

    let isConnected = false;
    let setupSent = false;

    ws.on('open', () => {
      isConnected = true;

      // Send setup message with full Vertex AI resource path
      const setupMessage = {
        setup: {
          model: `projects/${PROJECT_ID}/locations/${LIVE_API_LOCATION}/publishers/google/models/${LIVE_MODEL}`,
          generationConfig: {
            responseModalities: ['AUDIO', 'TEXT'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: config.voice || 'Puck',
                },
              },
            },
          },
          systemInstruction: {
            parts: [{ text: config.systemInstruction || SYSTEM_INSTRUCTION }],
          },
        },
      };

      ws.send(JSON.stringify(setupMessage));
      setupSent = true;
    });

    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());

        // Handle setup complete
        if (message.setupComplete) {
          config.onConnected?.();
          resolve(session);
          return;
        }

        // Handle server content (audio/text responses)
        if (message.serverContent) {
          const content = message.serverContent;

          // Check for turn completion
          if (content.turnComplete) {
            config.onTurnComplete?.();
            return;
          }

          // Check for interruption
          if (content.interrupted) {
            config.onInterrupted?.();
            return;
          }

          // Process model turn content
          if (content.modelTurn?.parts) {
            for (const part of content.modelTurn.parts) {
              // Handle audio data
              if (part.inlineData?.mimeType?.startsWith('audio/')) {
                config.onAudioData?.(part.inlineData.data);
              }

              // Handle text data (transcription)
              if (part.text) {
                config.onTextData?.(part.text);
              }
            }
          }
        }

        // Handle tool calls (future: RAG integration)
        if (message.toolCall) {
        }

      } catch (error) {
      }
    });

    ws.on('error', (error) => {
      config.onError?.(error);
      if (!setupSent) {
        reject(error);
      }
    });

    ws.on('close', (code, reason) => {
      const reasonStr = reason?.toString() || 'Unknown reason';
      isConnected = false;

      // Handle specific error codes
      if (code === 1008 || code === 1007) {
        const errorMsg = reasonStr.includes('not supported')
          ? 'Gemini Live API model not available. Please enable the Live API in your GCP project.'
          : `Connection rejected: ${reasonStr}`;
        config.onError?.(new Error(errorMsg));
      }

      config.onDisconnected?.();
    });

    const session: GeminiLiveSession = {
      sendAudio: (audioBase64: string) => {
        if (!isConnected) {
          return;
        }

        const audioMessage = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: 'audio/pcm;rate=16000',
                data: audioBase64,
              },
            ],
          },
        };

        ws.send(JSON.stringify(audioMessage));
      },

      sendText: (text: string) => {
        if (!isConnected) {
          return;
        }

        const textMessage = {
          clientContent: {
            turns: [
              {
                role: 'user',
                parts: [{ text }],
              },
            ],
            turnComplete: true,
          },
        };

        ws.send(JSON.stringify(textMessage));
      },

      interrupt: () => {
        if (!isConnected) return;

        // Send empty realtime input to signal interruption
        const interruptMessage = {
          realtimeInput: {
            mediaChunks: [],
          },
        };

        ws.send(JSON.stringify(interruptMessage));
      },

      close: () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
        isConnected = false;
      },

      isConnected: () => isConnected,
    };

    // Timeout for connection
    setTimeout(() => {
      if (!isConnected) {
        ws.close();
        reject(new Error('Connection timeout'));
      }
    }, 10000);
  });
}

/**
 * Convert Float32Array audio samples to base64 PCM
 */
export function audioSamplesToBase64(samples: Float32Array): string {
  // Convert float32 (-1 to 1) to int16 (-32768 to 32767)
  const int16Array = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  // Convert to base64
  const bytes = new Uint8Array(int16Array.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return Buffer.from(binary, 'binary').toString('base64');
}

/**
 * Convert base64 PCM to Float32Array for playback
 */
export function base64ToAudioSamples(base64: string): Float32Array {
  const binary = Buffer.from(base64, 'base64');
  const int16Array = new Int16Array(binary.buffer, binary.byteOffset, binary.length / 2);

  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
  }

  return float32Array;
}
