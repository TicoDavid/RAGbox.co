/**
 * Inworld TTS Client
 *
 * Text-to-speech synthesis via Inworld AI with emotion-aware tagging.
 * Maps response context to emotion prefixes for natural voice output.
 */

import { apiFetch } from '@/lib/api';
import { TTSRequest, ResponseContext } from './types';

export class InworldClient {
  private getEmotionTag(context: ResponseContext): string {
    if (context.isError) return '[apologetic]';
    if (context.isGreeting) return '[warm]';
    if (context.isPrivilegeFiltered) return '[serious]';
    if (context.hasWarning) return '[concerned]';
    if (context.confidence < 0.85) return '[thoughtful]';
    return '[confident]';
  }

  prepareTextForTTS(text: string, context: ResponseContext): string {
    const emotionTag = this.getEmotionTag(context);
    return `${emotionTag} ${text}`;
  }

  async synthesize(request: TTSRequest): Promise<ArrayBuffer> {
    let text = request.text;
    if (request.emotion) {
      text = `[${request.emotion}] ${text}`;
    }

    const response = await apiFetch('/api/voice/synthesize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voiceId: request.voiceId,
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS synthesis failed: ${response.status}`);
    }

    return response.arrayBuffer();
  }
}
