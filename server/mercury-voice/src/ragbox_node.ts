import { CustomNode, ProcessContext } from '@inworld/runtime/graph';
import { GraphTypes } from '@inworld/runtime/common';

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || 'http://localhost:8080';
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || '';

interface RAGboxInput {
  text: string;
  userId: string;
  personaId?: string;
  threadId?: string;
}

/**
 * RAGboxNode — CustomNode that calls the Go backend /api/chat for RAG answers.
 *
 * process() flow:
 * 1. Calls Go backend /api/chat with mode=voice, streaming=false
 * 2. Parses the JSON response
 * 3. Strips citations [N] and markdown for TTS-clean output
 * 4. Returns text content for downstream TextChunkingNode → RemoteTTSNode
 */
export class RAGboxNode extends CustomNode {
  async process(
    _context: ProcessContext,
    input: RAGboxInput
  ): Promise<GraphTypes.Content> {
    const { text, userId, personaId, threadId } = input;

    try {
      // Call Go backend — non-streaming for voice (we need complete text for TTS)
      const res = await fetch(`${GO_BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Auth': INTERNAL_AUTH_SECRET,
          'X-User-ID': userId,
        },
        body: JSON.stringify({
          query: text,
          stream: false,
          mode: 'voice',
          persona: personaId || undefined,
          threadId: threadId || undefined,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[RAGboxNode] Backend error ${res.status}:`, errText);
        return new GraphTypes.Content({
          content: 'I encountered an issue processing your request. Please try again.',
        });
      }

      const body = await res.json() as {
        answer?: string;
        citations?: unknown[];
        confidence?: number;
      };

      const rawAnswer = body.answer || '';

      // Strip citations [1], [2] etc. and markdown formatting for voice output
      const voiceText = stripForVoice(rawAnswer);

      if (!voiceText) {
        return new GraphTypes.Content({
          content: "I don't have enough information in the vault to answer that question.",
        });
      }

      return new GraphTypes.Content({ content: voiceText });
    } catch (error) {
      console.error('[RAGboxNode] Error calling backend:', error);
      return new GraphTypes.Content({
        content: 'I had trouble connecting to the knowledge base. Please try again.',
      });
    }
  }
}

/**
 * Strip citation markers, markdown formatting, and other non-speech content
 * for clean TTS output.
 */
function stripForVoice(text: string): string {
  return text
    // Remove citation references [1], [2], etc.
    .replace(/\[\d+\]/g, '')
    // Remove markdown bold/italic
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove markdown links [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove code fences
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove bullet markers
    .replace(/^[\s]*[-*•]\s+/gm, '')
    // Collapse multiple spaces/newlines
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
