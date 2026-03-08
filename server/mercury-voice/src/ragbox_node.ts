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

type Intent = 'document' | 'conversational' | 'meta' | 'greeting' | 'followup';

/** Confidence threshold — below this, default to document intent (safer to over-retrieve). */
const INTENT_CONFIDENCE_THRESHOLD = 0.7;

/**
 * RAGboxNode — CustomNode that calls the Go backend /api/chat for RAG answers.
 *
 * Phase 3 additions:
 * - 5-way intent detection: document / conversational / meta / greeting / followup
 * - Mercury personality-driven responses for non-document intents
 * - Voice response formatting (stripForVoice) with 3-sentence cap
 */
export class RAGboxNode extends CustomNode {
  async process(
    _context: ProcessContext,
    input: RAGboxInput
  ): Promise<string> {
    const { text, userId, personaId, threadId, conversationHistory, userContext } = input;

    const { intent, confidence } = classifyIntent(text, conversationHistory);

    // Low-confidence fallback: default to document (safer to over-retrieve)
    const resolvedIntent = confidence < INTENT_CONFIDENCE_THRESHOLD ? 'document' : intent;

    if (resolvedIntent === 'greeting') {
      return handleGreeting(text, userContext);
    }

    if (resolvedIntent === 'conversational') {
      return handleConversational(text);
    }

    if (resolvedIntent === 'meta') {
      return handleMeta();
    }

    if (resolvedIntent === 'followup') {
      return handleFollowup(text, conversationHistory);
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
        return "I don't have enough information in the vault to answer that. Want me to try a different angle?";
      }

      return voiceText;
    } catch (error) {
      console.error('[RAGboxNode] Error calling backend:', error);
      return 'I had trouble connecting to the knowledge base. Please try again.';
    }
  }
}

/**
 * 5-way intent classification with confidence scoring.
 * Returns both intent and confidence (0-1).
 */
export function classifyIntent(
  text: string,
  history?: ConversationTurn[]
): { intent: Intent; confidence: number } {
  const lower = text.toLowerCase().trim();

  // Meta patterns — high confidence
  const metaPatterns = [
    /^(what can you do|help me|what are you|who are you|how do you work)/,
    /^(what('s| is) your (purpose|role|function))/,
    /^(capabilities|features|commands)/,
  ];
  if (metaPatterns.some(p => p.test(lower))) {
    return { intent: 'meta', confidence: 0.95 };
  }

  // Greeting patterns — high confidence
  const greetingPatterns = [
    /^(hi|hello|hey|howdy|yo)(\s|$|!|,)/,
    /^good (morning|afternoon|evening|night)(\s|$|!|,)/,
    /^(nice to meet you|pleasure)\b/,
  ];
  if (greetingPatterns.some(p => p.test(lower))) {
    return { intent: 'greeting', confidence: 0.9 };
  }

  // Followup patterns — requires conversation history
  if (history && history.length > 0) {
    const followupPatterns = [
      /^(tell me more|go on|continue|expand on that|keep going)/,
      /^(what else|and\??|more details|elaborate)\s*$/,
      /^(can you explain|explain that|say more)\b/,
      /^(dig deeper|go deeper|more about that)\b/,
    ];
    if (followupPatterns.some(p => p.test(lower))) {
      return { intent: 'followup', confidence: 0.85 };
    }
  }

  // Conversational patterns — thanks, goodbye, how-are-you
  const conversationalPatterns = [
    /^(thanks|thank you|thx)\b/,
    /^(bye|goodbye|see you|later|good night|take care)\b/,
    /^(how are you|how('s| is) it going|what('s| is) up)\b/,
  ];
  if (conversationalPatterns.some(p => p.test(lower))) {
    return { intent: 'conversational', confidence: 0.85 };
  }

  // Default: document query
  return { intent: 'document', confidence: 0.8 };
}

/** Warm greeting response referencing user context if available. */
function handleGreeting(text: string, userContext?: UserContext): string {
  const name = userContext?.name;
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  if (name) {
    return `Good ${timeGreeting}, ${name}! What can I help you with?`;
  }
  return `Good ${timeGreeting}! I'm ready whenever you are. What would you like to explore?`;
}

/** Personality-driven conversational response (skip RAG). */
function handleConversational(text: string): string {
  const lower = text.toLowerCase().trim();

  if (/^(thanks|thank you|thx)/.test(lower)) {
    return "Happy to help! Let me know if anything else comes up.";
  }
  if (/^(bye|goodbye|see you|later|good night|take care)/.test(lower)) {
    return "Take care! I'll be here whenever you need me.";
  }
  if (/^(how are you|how('s| is) it going)/.test(lower)) {
    return "Doing well, thanks for asking! Ready to dig into whatever you need.";
  }
  return "I'm here and ready. What can I look into for you?";
}

/** Capability summary with Mercury personality. */
function handleMeta(): string {
  return "I can search your vault, summarize documents, compare content across files, " +
    "and flag key findings with citations. I can also send emails and generate reports. " +
    "Just ask me anything about your documents.";
}

/**
 * Followup handler — expands on the last assistant response.
 * Sends a "tell me more" style query to the Go backend with full history
 * so the LLM can expand naturally.
 */
async function handleFollowup(
  text: string,
  history?: ConversationTurn[]
): Promise<string> {
  const lastAssistant = history
    ?.filter(t => t.role === 'assistant')
    .pop();

  if (!lastAssistant) {
    return "I don't have anything to expand on yet. Ask me a question first!";
  }

  // Re-query with explicit instruction to expand
  const expandedQuery = `The user said: "${text}". ` +
    `My previous response was: "${lastAssistant.content}". ` +
    `Please expand on this with more detail and context from the vault.`;

  try {
    const res = await fetch(`${GO_BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Auth': INTERNAL_AUTH_SECRET,
      },
      body: JSON.stringify({
        query: expandedQuery,
        stream: false,
        mode: 'detailed',
        conversationHistory: history,
      }),
    });

    if (!res.ok) {
      return "I'd love to expand on that, but I hit a snag. Can you try rephrasing?";
    }

    const body = await res.json() as { answer?: string };
    const rawAnswer = body.answer || '';
    return stripForVoice(rawAnswer) || "I don't have more detail on that in the vault right now.";
  } catch {
    return "I had trouble expanding on that. Try asking a more specific question.";
  }
}

/**
 * Strip citation markers, markdown formatting, and other non-speech content
 * for clean TTS output. Uses sentence-boundary detection for natural chunking.
 * Cap at 3 sentences for voice brevity (Phase 3 polish).
 */
export function stripForVoice(text: string): string {
  const cleaned = text
    // Remove citation markers [1], [2], etc.
    .replace(/\[\d+\]/g, '')
    // Remove bold/italic markdown
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
    // Remove heading markers
    .replace(/^#{1,6}\s+/gm, '')
    // Remove markdown links, keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove bullet points
    .replace(/^[\s]*[-*•]\s+/gm, '')
    // Remove numbered list markers
    .replace(/^\s*\d+\.\s+/gm, '')
    // Collapse double newlines into sentence boundary
    .replace(/\n{2,}/g, '. ')
    // Collapse single newlines into spaces
    .replace(/\n/g, ' ')
    // Clean up multiple spaces
    .replace(/\s{2,}/g, ' ')
    // Clean up multiple periods
    .replace(/\.{2,}/g, '.')
    // Clean up space before punctuation
    .replace(/\s+([.!?])/g, '$1')
    .trim();

  // Sentence-boundary detection: split on sentence-ending punctuation
  // followed by a space and uppercase letter (or end of string)
  const sentences = cleaned.match(/[^.!?]*[.!?]+(?:\s|$)/g);
  if (sentences && sentences.length > 3) {
    return sentences.slice(0, 3).join('').trim();
  }

  return cleaned;
}
