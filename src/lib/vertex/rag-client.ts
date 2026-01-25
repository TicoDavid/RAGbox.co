import { VertexAI, GenerateContentResult } from '@google-cloud/vertexai';

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

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

const SYSTEM_PROMPT = `You are Mercury, the AI assistant for RAGbox - a sovereign document intelligence platform.

Key traits:
- Professional, precise, and security-conscious
- Provide clear, well-structured responses
- When discussing RAGbox, explain its capabilities: secure document storage, AI-powered analysis, compliance features, and audit logging
- If asked about documents you don't have access to, politely indicate that no documents are currently loaded

Always be helpful while maintaining a professional, enterprise-grade tone.`;

export class RAGboxClient {
  private model;

  constructor() {
    this.model = getVertexAI().getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM_PROMPT,
    });
  }

  /**
   * Direct chat with Gemini (no RAG context)
   * Used for general conversation before documents are loaded
   */
  async chat(message: string): Promise<ChatResponse> {
    try {
      const result: GenerateContentResult = await this.model.generateContent(message);
      const response = result.response;
      const answer = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const finishReason = response.candidates?.[0]?.finishReason;

      return {
        answer,
        model: MODEL,
        finishReason,
      };
    } catch (error) {
      console.error('[RAGboxClient] Chat error:', error);
      throw error;
    }
  }

  /**
   * Stream chat response token by token
   */
  async chatStream(message: string, callbacks: StreamCallbacks): Promise<void> {
    try {
      const streamingResult = await this.model.generateContentStream(message);
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
      console.error('[RAGboxClient] Stream error:', error);
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * RAG query with document context
   * Used when documents are loaded and we need grounded responses
   */
  async query(question: string, context: string[]): Promise<RAGResponse> {
    const contextText = context.map((c, i) => `[${i + 1}] ${c}`).join('\n\n');

    const prompt = `Based on the following context, answer the question. Cite sources using [1], [2], etc.

CONTEXT:
${contextText}

QUESTION: ${question}

Provide a clear, well-structured answer with citations.`;

    try {
      const result = await this.model.generateContent(prompt);
      const answer = result.response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Extract citation numbers from the answer
      const citationMatches = answer.match(/\[(\d+)\]/g) || [];
      const citedIndices = [...new Set(citationMatches.map(m => parseInt(m.replace(/[\[\]]/g, '')) - 1))];

      const citations = citedIndices
        .filter(i => i >= 0 && i < context.length)
        .map(i => ({
          text: context[i].substring(0, 200) + (context[i].length > 200 ? '...' : ''),
          source: `doc-${i + 1}`,
          score: 0.9,
        }));

      // Calculate confidence based on citations found
      const confidence = citations.length > 0 ? 0.85 + (citations.length * 0.02) : 0.7;

      return {
        answer,
        citations,
        confidence: Math.min(confidence, 0.98),
      };
    } catch (error) {
      console.error('[RAGboxClient] Query error:', error);
      throw error;
    }
  }
}

export const ragClient = new RAGboxClient();