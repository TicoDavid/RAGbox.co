// app/api/about/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  return NextResponse.json({
    name: 'Mercury',
    identity: "I'm Mercury\u2014RAGbox's secure retrieval assistant.",
    version: '2.0.0',
    backend: {
      frontend: 'Next.js 14 (Cloud Run)',
      storage: 'Google Cloud Storage (CMEK)',
      vectorDb: 'Weaviate (GKE Autopilot)',
      database: 'Cloud SQL PostgreSQL + pgvector',
      models: {
        primary: 'Llama 3.3 (70B) on Vertex AI Prediction',
        secondary: 'Gemini 1.5 Pro via Vertex API (Deep Audit / large-context)',
      },
      audit: 'Veritas (BigQuery immutable, hash-chained log entries)',
      policy: {
        silenceProtocol: 'If confidence < 0.85, refuse and ask for clarification.',
        citations: 'Answers must be citation-backed (doc/page/paragraph).',
        zeroRetention: 'No user data persists beyond the active session scope.',
      },
    },
  });
}
