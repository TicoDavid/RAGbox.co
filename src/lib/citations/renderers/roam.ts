/**
 * ROAM Citation Renderer
 *
 * Formats CitationBlock[] as plain text with emoji confidence indicators.
 * Integrates with the ROAM message format (plain text, 4000 char limit).
 */

import type { CitationBlock } from '../types'

const CONFIDENCE_ICONS: Record<string, string> = {
  green: '🟢',
  amber: '🟡',
  red: '🔴',
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

/**
 * Render a single CitationBlock as plain text for ROAM.
 */
function renderBlock(block: CitationBlock, index: number): string {
  const icon = CONFIDENCE_ICONS[block.confidenceColor] ?? '⚪'
  const label = CONFIDENCE_LABELS[block.confidenceLevel] ?? 'Unknown'
  const score = block.confidenceScore.toFixed(2)
  const excerpt = block.excerpt.length > 120
    ? block.excerpt.slice(0, 119) + '…'
    : block.excerpt

  return [
    `[${index + 1}] 📄 ${block.sourceName}`,
    `    ${icon} Confidence: ${label} (${score})`,
    `    "${excerpt}"`,
    `    Evidence: Doc(${block.documentId.slice(0, 8)}…), Retrieved ${block.retrievalTimestamp.split('T')[0]}`,
  ].join('\n')
}

/**
 * Format an array of CitationBlocks for ROAM delivery.
 */
export function formatCitationBlocksForRoam(blocks: CitationBlock[]): string {
  if (blocks.length === 0) return ''

  const rendered = blocks.map((b, i) => renderBlock(b, i)).join('\n\n')
  return `─── Sources ───\n${rendered}`
}
