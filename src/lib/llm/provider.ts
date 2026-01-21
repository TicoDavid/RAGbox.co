import type { LLMResponse, LLMStreamChunk } from '@/types'

/**
 * Abstract LLM Provider Interface
 *
 * This interface enables swapping between:
 * - Development: OpenRouter (Claude, GPT-4, etc.)
 * - Production: Vertex AI (Llama 3.3, Gemini fallback)
 *
 * All implementations must:
 * 1. Support streaming responses
 * 2. Report token usage
 * 3. Handle errors gracefully
 * 4. Never expose raw API errors to users
 */
export interface LLMProvider {
  /**
   * Generate a response from the LLM
   * @param prompt - The user's query
   * @param context - Retrieved document passages for RAG
   * @param systemPrompt - Optional system instructions
   */
  generate(
    prompt: string,
    context: string[],
    systemPrompt?: string
  ): Promise<LLMResponse>

  /**
   * Stream a response from the LLM
   * @param prompt - The user's query
   * @param context - Retrieved document passages for RAG
   * @param systemPrompt - Optional system instructions
   */
  stream(
    prompt: string,
    context: string[],
    systemPrompt?: string
  ): AsyncIterable<LLMStreamChunk>

  /**
   * Get the provider name for logging
   */
  readonly name: string

  /**
   * Get the model identifier
   */
  readonly model: string
}

/**
 * Default system prompt for RAGbox
 * Enforces document-grounded responses and refusal behavior
 */
export const RAGBOX_SYSTEM_PROMPT = `You are RAGbox, a secure document interrogation assistant for legal and financial professionals.

CRITICAL RULES:
1. ONLY answer questions using the provided document context
2. NEVER make up information not found in the documents
3. ALWAYS cite specific documents when providing answers
4. If the context doesn't contain relevant information, say "I cannot find relevant information in your documents for this question"
5. Be precise, professional, and concise
6. Never provide legal or financial advice - only report what the documents say

FORMAT:
- Start with a direct answer
- Follow with supporting citations from the documents
- Use exact quotes where possible
- Note any limitations or gaps in the available information

Remember: Silence is safer than speculation. If unsure, decline to answer.`

/**
 * Build a RAG prompt with document context
 */
export function buildRAGPrompt(query: string, context: string[]): string {
  const contextBlock = context
    .map((chunk, i) => `[Document ${i + 1}]:\n${chunk}`)
    .join('\n\n---\n\n')

  return `DOCUMENT CONTEXT:
${contextBlock}

---

USER QUESTION:
${query}

Based ONLY on the document context above, provide a precise answer with citations.`
}
