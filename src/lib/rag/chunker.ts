/**
 * Document Chunker - RAGbox.co
 *
 * Splits extracted text into overlapping chunks optimized for embedding.
 * Uses 512 token target with 64 token overlap.
 */

const CHARS_PER_TOKEN = 4
const DEFAULT_CHUNK_TOKENS = 512
const DEFAULT_OVERLAP_TOKENS = 64
const DEFAULT_CHUNK_SIZE = DEFAULT_CHUNK_TOKENS * CHARS_PER_TOKEN // ~2048 chars
const DEFAULT_OVERLAP = DEFAULT_OVERLAP_TOKENS * CHARS_PER_TOKEN // ~256 chars

export interface ChunkResult {
  content: string
  chunkIndex: number
  tokenCount: number
  startOffset: number
  endOffset: number
}

/**
 * Chunk text into overlapping segments
 */
export function chunkText(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_OVERLAP
): ChunkResult[] {
  if (!text || text.length === 0) return []

  if (text.length <= chunkSize) {
    return [{
      content: text.trim(),
      chunkIndex: 0,
      tokenCount: Math.ceil(text.length / CHARS_PER_TOKEN),
      startOffset: 0,
      endOffset: text.length,
    }]
  }

  const chunks: ChunkResult[] = []
  let start = 0
  let index = 0

  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length)

    // Break at sentence/paragraph boundaries
    if (end < text.length) {
      const breakPoints = ['\n\n', '\n', '. ', '! ', '? ', '; ']
      for (const bp of breakPoints) {
        const lastBreak = text.lastIndexOf(bp, end)
        if (lastBreak > start + chunkSize / 2) {
          end = lastBreak + bp.length
          break
        }
      }
    }

    const content = text.slice(start, end).trim()
    if (content.length > 0) {
      chunks.push({
        content,
        chunkIndex: index,
        tokenCount: Math.ceil(content.length / CHARS_PER_TOKEN),
        startOffset: start,
        endOffset: end,
      })
      index++
    }

    start = end - overlap

    if (start >= text.length - overlap) break
  }

  return chunks
}

/**
 * Generate a content hash for deduplication
 */
export function hashContent(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}
