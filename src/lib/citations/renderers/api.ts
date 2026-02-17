/**
 * API Citation Renderer
 *
 * Pass-through renderer that returns CitationBlock[] as-is for JSON API responses.
 * Used by /api/v1/query to include structured citation blocks.
 */

import type { CitationBlock } from '../types'

/**
 * Format CitationBlocks for API JSON response.
 * Returns the blocks as-is — no transformation needed for JSON output.
 */
export function formatCitationBlocksForApi(blocks: CitationBlock[]): CitationBlock[] {
  return blocks
}
