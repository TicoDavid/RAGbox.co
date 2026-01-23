import { VertexAI } from '@google-cloud/vertexai';

const PROJECT_ID = process.env.GCP_PROJECT_ID!;
const LOCATION = process.env.GCP_LOCATION || 'us-east4';

const vertexAI = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION,
});

export interface RAGResponse {
  answer: string;
  citations: Array<{ text: string; source: string; score: number }>;
  confidence: number;
}

export class RAGboxClient {
  async query(question: string, context: string[]): Promise<RAGResponse> {
    const model = vertexAI.getGenerativeModel({
      model: 'gemini-2.0-flash-001',
    });

    const contextText = context.map((c, i) => `[${i + 1}] ${c}`).join('\n\n');

    const prompt = `You are RAGbox, a secure document intelligence assistant.
Answer based ONLY on the context. Cite sources as [1], [2], etc.

CONTEXT:
${contextText}

QUESTION: ${question}

ANSWER:`;

    const result = await model.generateContent(prompt);
    const answer = result.response.text() || '';

    return {
      answer,
      citations: context.map((text, i) => ({ text, source: `doc-${i}`, score: 0.9 })),
      confidence: 0.85,
    };
  }
}

export const ragClient = new RAGboxClient();