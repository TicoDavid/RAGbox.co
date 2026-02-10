// silenceProtocol.ts

/**
 * Silence Protocol
 * This module implements an 85% confidence gating mechanism for response validation.
 * When confidence falls below threshold, the system enters "Silence Protocol" -
 * refusing to answer rather than provide potentially incorrect information.
 */

interface RagResponse {
  confidence: number
  answer?: string
  citations?: string[]
}

const CONFIDENCE_THRESHOLD = 0.85

/**
 * Validates a RAG response against the confidence threshold.
 * @param response - The response object to validate.
 * @returns true if confidence meets threshold, false to trigger Silence Protocol.
 */
function validateResponse(response: RagResponse): boolean {
  return response.confidence >= CONFIDENCE_THRESHOLD
}

/**
 * Formats a Silence Protocol message when confidence is too low.
 * @param response - The low-confidence response.
 * @returns A formatted warning message.
 */
function formatSilenceProtocolMessage(response: RagResponse): string {
  const percentage = Math.round(response.confidence * 100)
  return `⚠️ SILENCE PROTOCOL ENGAGED\n\nConfidence level (${percentage}%) is below the required threshold (${Math.round(CONFIDENCE_THRESHOLD * 100)}%).\n\nI cannot provide a reliable answer to this query. Please try:\n- Rephrasing your question\n- Providing more context\n- Uploading additional relevant documents`
}

export { validateResponse, formatSilenceProtocolMessage, CONFIDENCE_THRESHOLD }
export type { RagResponse }
