/**
 * Mercury Thread Citation Renderer
 *
 * Formats CitationBlocks for the Mercury unified thread display.
 * Returns a lightweight summary string with channel badge and inline confidence.
 */

import type { CitationBlock } from '../types'

const CONFIDENCE_ICONS: Record<string, string> = {
  green: '🟢',
  amber: '🟡',
  red: '🔴',
}

/**
 * Format a single CitationBlock as a compact Mercury thread line.
 */
function renderMercuryLine(block: CitationBlock, index: number): string {
  const icon = CONFIDENCE_ICONS[block.confidenceColor] ?? '⚪'
  const score = Math.round(block.confidenceScore * 100)
  const excerpt = block.excerpt.length > 80
    ? block.excerpt.slice(0, 79) + '…'
    : block.excerpt
  return `[${index + 1}] ${icon} ${block.sourceName} (${score}%) — "${excerpt}"`
}

/**
 * Format CitationBlocks for Mercury unified thread display.
 */
export function formatCitationBlocksForMercury(blocks: CitationBlock[]): string {
  if (blocks.length === 0) return ''
  return blocks.map((b, i) => renderMercuryLine(b, i)).join('\n')
}
