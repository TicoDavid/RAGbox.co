/**
 * RAG Pipeline Orchestrator - RAGbox.co
 *
 * Orchestrates: embed query -> retrieve chunks -> generate answer -> parse citations -> score confidence
 *
 * SOVEREIGN PROTOCOL: If no documents are available, the AI is NOT blocked.
 * Instead, it falls back to Direct Chat mode with vault-empty context awareness.
 */

import { retrieveChunks } from './retriever'
import { parseCitations, calculateRAGConfidence } from './citation-parser'
import { ragClient } from '@/lib/vertex/rag-client'
import { getDocumentsByTier } from '@/lib/documents/store'
import type { RAGPipelineResult, RAGPipelineOptions } from '@/types/rag'

const CONFIDENCE_THRESHOLD = parseFloat(process.env.AEGIS_CONFIDENCE_THRESHOLD || '0.85')

// Context injection for empty vault scenarios
const EMPTY_VAULT_CONTEXT = `
CURRENT STATE: The user's document vault is EMPTY. No files have been uploaded yet.

SOVEREIGN PROTOCOL FOR EMPTY VAULT:
- You are FULLY OPERATIONAL. The vault being empty does not limit your intelligence.
- If the user asks to analyze a file or document: Guide them to upload files using the "Add Files" button in the Vault panel.
- If the user asks a general question (strategy, advice, explanations): Answer as a Sovereign Intelligence with full capability.
- If the user asks "Can you hear me?" or tests the connection: Confirm all security protocols are active and you are ready for data ingestion.
- Do NOT repeatedly apologize for the empty vault. State it once if relevant, then focus on being helpful.
- You can discuss RAGbox capabilities, security features, compliance standards, and general knowledge.
`.trim()

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

  // SOVEREIGN BYPASS: Empty vault does NOT block the AI
  // Instead, fallback to Direct Chat with vault-awareness
  if (accessibleDocIds.length === 0) {
    console.log('[RAG Pipeline] Empty vault detected - activating Sovereign Direct Chat fallback')

    // Inject empty-vault context into the system prompt
    const enhancedPrompt = options.systemPrompt
      ? `${options.systemPrompt}\n\n${EMPTY_VAULT_CONTEXT}`
      : EMPTY_VAULT_CONTEXT

    // Direct chat - the AI speaks freely but knows the vault is empty
    const response = await ragClient.chat(query, {
      systemPrompt: enhancedPrompt,
      history: options.history,
    })

    return {
      answer: response.answer,
      citations: [],
      confidence: 0.95, // High confidence for direct responses
      chunksUsed: 0,
      latencyMs: Date.now() - startTime,
      model: process.env.RAG_GENERATION_MODEL || 'gemini-2.0-flash-001',
      silenceProtocol: false, // NOT silenced - the AI is active
      retrievedChunks: [],
      emptyVault: true, // Flag for frontend awareness
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
