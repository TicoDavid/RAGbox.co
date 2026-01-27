/**
 * RAG Pipeline Orchestrator - RAGbox.co
 *
 * Orchestrates: embed query -> retrieve chunks -> generate answer -> parse citations -> score confidence
 */

import { retrieveChunks } from './retriever'
import { parseCitations, calculateRAGConfidence } from './citation-parser'
import { ragClient } from '@/lib/vertex/rag-client'
import { getDocumentsByTier } from '@/lib/documents/store'
import type { RAGPipelineResult, RAGPipelineOptions } from '@/types/rag'

const CONFIDENCE_THRESHOLD = parseFloat(process.env.AEGIS_CONFIDENCE_THRESHOLD || '0.85')

/**
 * Execute the full RAG pipeline
 */
export async function executeRAGPipeline(
  query: string,
  options: RAGPipelineOptions
): Promise<RAGPipelineResult> {
  const startTime = Date.now()

  // 1. Get accessible documents based on tier + privilege
  const accessibleDocs = await getDocumentsByTier(
    options.userId,
    options.maxTier,
    options.privilegeMode
  )
  const accessibleDocIds = accessibleDocs.map(d => d.id)

  if (accessibleDocIds.length === 0) {
    return {
      answer: 'No documents are available for querying. Please upload documents to your vault first.',
      citations: [],
      confidence: 0,
      chunksUsed: 0,
      latencyMs: Date.now() - startTime,
      model: process.env.RAG_GENERATION_MODEL || 'gemini-2.0-flash-001',
      silenceProtocol: true,
      retrievedChunks: [],
    }
  }

  // 2. Retrieve relevant chunks via vector search
  const topK = options.topK ?? 10
  const retrievedChunks = await retrieveChunks(query, accessibleDocIds, topK)

  if (retrievedChunks.length === 0) {
    return {
      answer: 'I could not find relevant information in your documents for this query.',
      citations: [],
      confidence: 0.3,
      chunksUsed: 0,
      latencyMs: Date.now() - startTime,
      model: process.env.RAG_GENERATION_MODEL || 'gemini-2.0-flash-001',
      silenceProtocol: true,
      retrievedChunks: [],
    }
  }

  // 3. Build context from retrieved chunks
  const context = retrievedChunks.map(
    (chunk, i) => `[${i + 1}] (${chunk.documentName || 'Document'}):\n${chunk.content}`
  )

  // 4. Generate answer with Gemini
  const response = await ragClient.query(query, context, {
    systemPrompt: options.systemPrompt,
    history: options.history,
  })

  // 5. Parse citations from the answer
  const citations = parseCitations(response.answer, retrievedChunks)

  // 6. Calculate confidence
  const hasHistory = (options.history?.length ?? 0) > 0
  const confidence = calculateRAGConfidence(retrievedChunks, citations, hasHistory)

  // 7. Apply Silence Protocol
  const effectiveThreshold = hasHistory ? CONFIDENCE_THRESHOLD * 0.8 : CONFIDENCE_THRESHOLD
  const silenceProtocol = confidence < effectiveThreshold

  const result: RAGPipelineResult = {
    answer: silenceProtocol
      ? 'I cannot provide a confident answer based on your documents. Please upload more relevant materials or rephrase your question.'
      : response.answer,
    citations,
    confidence,
    chunksUsed: retrievedChunks.length,
    latencyMs: Date.now() - startTime,
    model: process.env.RAG_GENERATION_MODEL || 'gemini-2.0-flash-001',
    silenceProtocol,
    retrievedChunks,
  }

  return result
}
