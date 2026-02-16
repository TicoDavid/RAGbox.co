/**
 * SSE Response Parser - RAGbox.co
 *
 * Shared utility for parsing Server-Sent Events from the Go backend /api/chat.
 * Used by both the dashboard chat and the WhatsApp webhook auto-reply.
 */

export interface ParsedRAGResponse {
  text: string
  confidence: number | undefined
  citations: Array<{ index: number; excerpt: string; documentId: string; documentName?: string }>
  isSilence: boolean
  suggestions?: string[]
}

/**
 * Parse a complete SSE response body into structured data.
 * Works with the text body (not streaming — reads all at once).
 */
export function parseSSEText(responseText: string): ParsedRAGResponse {
  const result: ParsedRAGResponse = {
    text: '',
    confidence: undefined,
    citations: [],
    isSilence: false,
  }

  let currentEvent = ''

  for (const line of responseText.split('\n')) {
    if (line.startsWith('event: ')) {
      currentEvent = line.slice(7).trim()
    } else if (line.startsWith('data: ')) {
      const dataStr = line.slice(6)
      try {
        const data = JSON.parse(dataStr)

        switch (currentEvent) {
          case 'token':
            result.text += data.text ?? ''
            break
          case 'citations':
            if (Array.isArray(data)) {
              result.citations = data.map((c: Record<string, unknown>, i: number) => ({
                index: (c.citationIndex as number) ?? i,
                excerpt: (c.excerpt as string) ?? '',
                documentId: (c.documentId as string) ?? '',
                documentName: (c.documentName as string) ?? undefined,
              }))
            } else if (data.citations) {
              result.citations = data.citations
            }
            break
          case 'confidence':
            result.confidence = data.score ?? data.confidence
            break
          case 'silence':
            result.isSilence = true
            result.text = data.message ?? 'Unable to provide a grounded answer.'
            result.confidence = data.confidence ?? 0
            result.suggestions = data.suggestions
            break
          case 'status':
          case 'done':
            break
          default:
            // Fallback: check known field names
            if (data.text) result.text += data.text
            if (data.score) result.confidence = data.score
            if (data.message && !result.text) {
              result.isSilence = true
              result.text = data.message
            }
            break
        }
      } catch {
        // Skip unparseable data lines
      }
    }
  }

  return result
}

/**
 * Parse an SSE Response object. Reads the entire body as text first.
 */
export async function parseSSEResponse(response: Response): Promise<ParsedRAGResponse> {
  const text = await response.text()
  return parseSSEText(text)
}
