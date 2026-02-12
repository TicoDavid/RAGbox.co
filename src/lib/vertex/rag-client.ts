import { VertexAI, GenerateContentResult, Content } from '@google-cloud/vertexai';

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'ragbox-sovereign-prod';
const LOCATION = process.env.GCP_LOCATION || 'us-east4';
const MODEL = process.env.RAG_GENERATION_MODEL || 'gemini-2.0-flash-001';

// Initialize Vertex AI client
let vertexAI: VertexAI;

function getVertexAI(): VertexAI {
  if (!vertexAI) {
    vertexAI = new VertexAI({
      project: PROJECT_ID,
      location: LOCATION,
    });
  }
  return vertexAI;
}

export interface RAGResponse {
  answer: string;
  citations: Array<{ text: string; source: string; score: number }>;
  confidence: number;
}

export interface ChatResponse {
  answer: string;
  model: string;
  finishReason?: string;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  systemPrompt?: string;
  history?: ChatHistoryMessage[];
  onToken?: (token: string) => void;
  onComplete?: (fullText: string) => void;
  onError?: (error: Error) => void;
}

export interface StreamCallbacks extends ChatOptions {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

const DEFAULT_SYSTEM_PROMPT = `You are Mercury, the Virtual Representative (V-Rep) for RAGbox - a sovereign document intelligence platform.

Key traits:
- Professional, precise, and security-conscious
- Provide clear, well-structured responses
- When discussing RAGbox, explain its capabilities: secure document storage, AI-powered analysis, compliance features, and audit logging
- If asked about documents you don't have access to, politely indicate that no documents are currently loaded

CRITICAL - Document Analysis Focus:
When users ask about "issues", "problems", "concerns", "risks", or similar terms regarding their documents:
- ALWAYS focus on the CONTENT and SUBSTANCE of the documents (business risks, legal concerns, compliance gaps, contractual issues, financial discrepancies, etc.)
- NEVER discuss technical processing issues (file formats, extraction failures, parsing errors)
- Analyze the actual text, clauses, data, and information WITHIN the documents
- Look for: liability exposure, missing clauses, ambiguous terms, compliance violations, financial risks, operational concerns, regulatory issues
- If you cannot extract meaningful content analysis, say so clearly rather than discussing technical limitations

Example: If asked "What issues do you see?" about a contract, discuss problematic clauses, missing protections, liability concerns - NOT file format issues.

Always be helpful while maintaining a professional, enterprise-grade tone.`;

// Token limits - Gemini 2.0 Flash supports ~1M tokens
// Reserve space for system prompt, question, and response
const MAX_CONTEXT_TOKENS = 800000; // ~800K tokens for context
const CHARS_PER_TOKEN = 4; // Rough estimate
const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;

export class RAGboxClient {
  /**
   * Get a model instance with optional custom system prompt
   */
  private getModel(systemPrompt?: string) {
    return getVertexAI().getGenerativeModel({
      model: MODEL,
      systemInstruction: systemPrompt || DEFAULT_SYSTEM_PROMPT,
    });
  }

  /**
   * Truncate context to fit within token limits
   * Distributes available space evenly across documents, then fills remaining space
   */
  private truncateContext(context: string[]): string[] {
    if (context.length === 0) return context;

    // Calculate total size
    const totalChars = context.reduce((sum, c) => sum + c.length, 0);
    const estimatedTokens = totalChars / CHARS_PER_TOKEN;

    // If within limits, return as-is
    if (totalChars <= MAX_CONTEXT_CHARS) {
      return context;
    }

    // Strategy: Allocate equal space per doc, truncate each
    const charsPerDoc = Math.floor(MAX_CONTEXT_CHARS / context.length);
    const truncated = context.map((doc, i) => {
      if (doc.length <= charsPerDoc) {
        return doc;
      }
      // Truncate with ellipsis indicator
      return doc.substring(0, charsPerDoc - 50) + '\n\n[... document truncated due to size limits ...]';
    });

    return truncated;
  }

  /**
   * Convert chat history to Vertex AI format
   */
  private formatHistory(history: ChatHistoryMessage[]): Content[] {
    return history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));
  }

  /**
   * Direct chat with Gemini (no RAG context)
   * Supports custom system prompt and chat history
   */
  async chat(message: string, options?: ChatOptions): Promise<ChatResponse> {
    const model = this.getModel(options?.systemPrompt);
    const history = options?.history ? this.formatHistory(options.history) : [];

    // Build request with history if provided
    let result: GenerateContentResult;

    if (history.length > 0) {
      // Use chat session for multi-turn conversation
      const chat = model.startChat({ history });
      result = await chat.sendMessage(message);
    } else {
      // Single turn
      result = await model.generateContent(message);
    }

    const response = result.response;
    const answer = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const finishReason = response.candidates?.[0]?.finishReason;

    return {
      answer,
      model: MODEL,
      finishReason,
    };
  }

  /**
   * Stream chat response token by token
   * Supports custom system prompt and chat history
   */
  async chatStream(message: string, callbacks: StreamCallbacks): Promise<void> {
    try {
      const model = this.getModel(callbacks.systemPrompt);
      const history = callbacks.history ? this.formatHistory(callbacks.history) : [];

      let streamingResult;

      if (history.length > 0) {
        const chat = model.startChat({ history });
        streamingResult = await chat.sendMessageStream(message);
      } else {
        streamingResult = await model.generateContentStream(message);
      }

      let fullText = '';

      for await (const chunk of streamingResult.stream) {
        const chunkText = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (chunkText) {
          fullText += chunkText;
          callbacks.onToken(chunkText);
        }
      }

      callbacks.onComplete(fullText);
    } catch (error) {
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * RAG query with document context
   * Supports custom system prompt and chat history for follow-up questions
   */
  async query(question: string, context: string[], options?: ChatOptions): Promise<RAGResponse> {
    // Truncate context to fit within token limits
    const safeContext = this.truncateContext(context);
    const contextText = safeContext.map((c, i) => `[${i + 1}] ${c}`).join('\n\n');

    // Build system instruction that includes protocol mode
    const systemInstruction = options?.systemPrompt
      ? `${options.systemPrompt}\n\nWhen answering questions, cite your sources using [1], [2], etc.`
      : `${DEFAULT_SYSTEM_PROMPT}\n\nWhen answering questions based on provided context, cite your sources using [1], [2], etc.`;

    const model = this.getModel(systemInstruction);
    const history = options?.history ? this.formatHistory(options.history) : [];

    const prompt = `Based on the following context, answer the question.

CONTEXT:
${contextText}

QUESTION: ${question}

Provide a clear, well-structured answer with citations using [1], [2], etc.`;

    try {
      let result: GenerateContentResult;

      if (history.length > 0) {
        // Use chat session for follow-up questions
        const chat = model.startChat({ history });
        result = await chat.sendMessage(prompt);
      } else {
        result = await model.generateContent(prompt);
      }

      const answer = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Extract citation numbers from the answer
      const citationMatches = answer.match(/\[(\d+)\]/g) || [];
      const citedIndices = Array.from(new Set(citationMatches.map(m => parseInt(m.replace(/[[\]]/g, '')) - 1)));

      const citations = citedIndices
        .filter(i => i >= 0 && i < context.length)
        .map(i => ({
          text: context[i].substring(0, 200) + (context[i].length > 200 ? '...' : ''),
          source: `doc-${i + 1}`,
          score: 0.9,
        }));

      // Calculate confidence based on citations found
      // Higher confidence if we have history (follow-up questions are expected to build on context)
      const baseConfidence = options?.history?.length ? 0.80 : 0.70;
      const confidence = citations.length > 0 ? 0.85 + (citations.length * 0.02) : baseConfidence;

      return {
        answer,
        citations,
        confidence: Math.min(confidence, 0.98),
      };
    } catch (error) {
      // Check for token limit errors and provide clearer message
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('token count') || errorMessage.includes('exceeds the maximum')) {
        throw new Error('Document context is too large. Try selecting fewer documents or asking about specific sections.');
      }

      throw error;
    }
  }
}

export const ragClient = new RAGboxClient();
