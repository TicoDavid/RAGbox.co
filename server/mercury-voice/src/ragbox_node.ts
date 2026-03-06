import { CustomNode, ProcessContext } from '@inworld/runtime/graph';

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || 'http://localhost:8080';
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || '';

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface UserContext {
  name?: string;
  role?: string;
  recentTopics?: string[];
}

export interface RAGboxInput {
  text: string;
  userId: string;
  personaId?: string;
  threadId?: string;
  conversationHistory?: ConversationTurn[];
  userContext?: UserContext;
}

type Intent = 'document' | 'conversational' | 'meta';

/**
 * RAGboxNode — CustomNode that calls the Go backend /api/chat for RAG answers.
 *
 * Phase 2 additions:
 * - Intent detection: document / conversational / meta
 * - Conversation history passed to Go backend for context
 * - Voice response formatting (stripForVoice)
 */
export class RAGboxNode extends CustomNode {
  async process(
    _context: ProcessContext,
    input: RAGboxInput
  ): Promise<string> {
    const { text, userId, personaId, threadId, conversationHistory, userContext } = input;

    // Step 4: Intent detection
    const intent = classifyIntent(text);

    // Conversational intents skip RAG entirely
    if (intent === 'conversational') {
      return handleConversational(text);
    }

    // Meta intents return capability summary
    if (intent === 'meta') {
      return handleMeta();
    }

    // Document intent → full RAG pipeline via Go backend
    try {
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
          mode: 'concise',
          persona: personaId || undefined,
          threadId: threadId || undefined,
          conversationHistory: conversationHistory || undefined,
          userContext: userContext || undefined,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[RAGboxNode] Backend error ${res.status}:`, errText);
        return 'I encountered an issue processing your request. Please try again.';
      }

      const body = await res.json() as {
        answer?: string;
        citations?: unknown[];
        confidence?: number;
      };

      const rawAnswer = body.answer || '';
      const voiceText = stripForVoice(rawAnswer);

      if (!voiceText) {
        return "I don't have enough information in the vault to answer that question.";
      }

      return voiceText;
    } catch (error) {
      console.error('[RAGboxNode] Error calling backend:', error);
      return 'I had trouble connecting to the knowledge base. Please try again.';
    }
  }
}

/**
 * Classify user intent for voice mode.
 * - document: question about documents/content
 * - conversational: greetings, small talk
 * - meta: "what can you do", "help"
 */
function classifyIntent(text: string): Intent {
  const lower = text.toLowerCase().trim();

  // Meta patterns
  const metaPatterns = [
    /^(what can you do|help me|what are you|who are you|how do you work)/,
    /^(what('s| is) your (purpose|role|function))/,
    /^(capabilities|features|commands)/,
  ];
  if (metaPatterns.some(p => p.test(lower))) return 'meta';

  // Conversational patterns
  const conversationalPatterns = [
    /^(hi|hello|hey|good (morning|afternoon|evening)|howdy|yo)\b/,
    /^(how are you|how('s| is) it going|what('s| is) up)\b/,
    /^(thanks|thank you|bye|goodbye|see you|later|good night)\b/,
    /^(nice to meet you|pleasure)\b/,
  ];
  if (conversationalPatterns.some(p => p.test(lower))) return 'conversational';

  // Everything else → document query
  return 'document';
}

function handleConversational(text: string): string {
  const lower = text.toLowerCase().trim();

  if (/^(thanks|thank you)/.test(lower)) {
    return "You're welcome! Let me know if you need anything else from your documents.";
  }
  if (/^(bye|goodbye|see you|later|good night)/.test(lower)) {
    return "Goodbye! I'll be here whenever you need to explore your vault.";
  }
  if (/^(how are you|how('s| is) it going)/.test(lower)) {
    return "I'm doing great, thanks for asking! Ready to help you with your documents whenever you need.";
  }
  return "Hi there! I'm ready to help you explore your document vault. What would you like to know?";
}

function handleMeta(): string {
  return "I can help you search and analyze your uploaded documents. " +
    "Ask me questions about your files, and I'll find the relevant information with citations. " +
    "I can summarize documents, compare content across files, and highlight key findings.";
}

/**
 * Strip citation markers, markdown formatting, and other non-speech content
 * for clean TTS output. Cap at ~4 sentences for voice brevity.
 */
function stripForVoice(text: string): string {
  const cleaned = text
    .replace(/\[\d+\]/g, '')
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[\s]*[-*•]\s+/gm, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Cap at ~4 sentences for voice brevity
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 4) {
    return sentences.slice(0, 4).join('').trim();
  }

  return cleaned;
}
