/**
 * DeepSeek Endpoint Client - RAGbox.co FORGE System
 *
 * Client for DeepSeek model via Vertex AI endpoint for OCR and analysis tasks.
 * Falls back to Gemini if DeepSeek endpoint is not configured.
 */

import { ragClient } from '@/lib/vertex/rag-client'

export interface DeepSeekResponse {
  text: string
  model: string
  tokensUsed: number
}

const DEEPSEEK_ENDPOINT = process.env.DEEPSEEK_ENDPOINT_URL
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY

/**
 * Send a prompt to DeepSeek for document analysis.
 * Falls back to Gemini via ragClient if DeepSeek is not configured.
 */
export async function analyzeWithDeepSeek(
  prompt: string,
  systemPrompt?: string
): Promise<DeepSeekResponse> {
  // If DeepSeek endpoint is configured, use it directly
  if (DEEPSEEK_ENDPOINT && DEEPSEEK_API_KEY) {
    try {
      const response = await fetch(DEEPSEEK_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
          max_tokens: 4096,
        }),
      })

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`)
      }

      const data = await response.json()
      return {
        text: data.choices?.[0]?.message?.content || '',
        model: 'deepseek',
        tokensUsed: data.usage?.total_tokens || 0,
      }
    } catch (error) {
      console.warn('[FORGE] DeepSeek unavailable, falling back to Gemini:', error)
    }
  }

  // Fallback to Gemini via ragClient
  const response = await ragClient.chat(prompt, {
    systemPrompt: systemPrompt || 'You are a document analysis assistant.',
  })

  return {
    text: response.answer,
    model: 'gemini-fallback',
    tokensUsed: 0,
  }
}
