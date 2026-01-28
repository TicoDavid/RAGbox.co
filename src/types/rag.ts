/**
 * RAG Pipeline Types - RAGbox.co
 */

export interface RetrievedChunk {
  chunkId: string
  documentId: string
  content: string
  chunkIndex: number
  similarity: number
  documentName?: string
  securityTier?: number
}

export interface StructuredCitation {
  citationIndex: number
  documentId: string
  chunkId: string
  documentName: string
  excerpt: string
  relevanceScore: number
  securityTier: number
}

export interface RAGPipelineResult {
  answer: string
  citations: StructuredCitation[]
  confidence: number
  chunksUsed: number
  latencyMs: number
  model: string
  silenceProtocol: boolean
  retrievedChunks: RetrievedChunk[]
}

export interface RAGPipelineOptions {
  userId: string
  privilegeMode: boolean
  maxTier: number
  systemPrompt?: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  topK?: number
}
