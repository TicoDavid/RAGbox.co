/**
 * ROAM Message Formatter
 *
 * Converts Mercury RAG output into ROAM-safe plain text.
 * ROAM supports plain text only (no markdown rendering).
 *
 * Rules:
 * - Strip markdown bold/italic/links → plain text
 * - Inline citations [1] → footnote block at bottom
 * - Silence Protocol → structured refusal message
 * - Max 4000 chars (ROAM message limit) with truncation indicator
 */

import type { Citation } from '@/types/ragbox'
import type { CitationBlock } from '@/lib/citations/types'
import { formatCitationBlocksForRoam } from '@/lib/citations/renderers/roam'

const ROAM_MAX_CHARS = 4000
const TRUNCATION_MARKER = '\n\n[…response truncated]'

// ── Mercury → ROAM plain text ──────────────────────────────────────

export interface FormatOptions {
  /** Include citation footnotes (default: true) */
  includeCitations?: boolean
  /** Include confidence score (default: false — only shown if < 0.75) */
  showConfidence?: boolean
  /** Confidence value 0-1 */
  confidence?: number
}

/**
 * Format a Mercury RAG answer for ROAM delivery.
 */
export function formatForRoam(
  answer: string,
  citations: Citation[],
  options: FormatOptions = {}
): string {
  const { includeCitations = true, confidence } = options

  let text = stripMarkdown(answer)

  // Append citation footnotes
  if (includeCitations && citations.length > 0) {
    const footnotes = citations
      .map(c => `[${c.citationIndex}] ${c.documentName}: "${truncateExcerpt(c.excerpt, 120)}"`)
      .join('\n')
    text = `${text}\n\n─── Sources ───\n${footnotes}`
  }

  // Low-confidence warning
  if (confidence !== undefined && confidence < 0.75) {
    text = `${text}\n\n⚠ Confidence: ${Math.round(confidence * 100)}% — verify against source documents.`
  }

  return enforceCharLimit(text)
}

/**
 * Format a Silence Protocol refusal for ROAM.
 */
export function formatSilenceForRoam(suggestions?: string[]): string {
  const lines = [
    '🔇 M.E.R.C.U.R.Y. — Silence Protocol',
    '',
    'I cannot provide a confident answer to this query based on the documents in your vault.',
    'Rather than speculate, I choose to remain silent.',
  ]

  if (suggestions && suggestions.length > 0) {
    lines.push('', 'You might try:')
    for (const s of suggestions) {
      lines.push(`  • ${s}`)
    }
  }

  lines.push('', 'Upload relevant documents to the Vault to improve coverage.')

  return enforceCharLimit(lines.join('\n'))
}

/**
 * Format an error message for ROAM.
 */
export function formatErrorForRoam(errorCode?: string): string {
  return [
    '⚠ M.E.R.C.U.R.Y. — Processing Error',
    '',
    'I encountered an issue processing your request.',
    errorCode ? `Error: ${errorCode}` : '',
    'Please try again, or ask in the dashboard for more detail.',
  ].filter(Boolean).join('\n')
}

/**
 * Format a Mercury RAG answer for ROAM using structured CitationBlocks.
 * Backward compatible — falls back to formatForRoam() if no blocks provided.
 */
export function formatWithCitationBlocks(
  answer: string,
  blocks: CitationBlock[],
  options: FormatOptions = {}
): string {
  const { confidence } = options

  let text = stripMarkdown(answer)

  // Append structured citation blocks
  if (blocks.length > 0) {
    const citationSection = formatCitationBlocksForRoam(blocks)
    text = `${text}\n\n${citationSection}`
  }

  // Low-confidence warning
  if (confidence !== undefined && confidence < 0.75) {
    text = `${text}\n\n⚠ Confidence: ${Math.round(confidence * 100)}% — verify against source documents.`
  }

  return enforceCharLimit(text)
}

/**
 * Format a meeting summary for ROAM delivery.
 * Includes title, participants, summary text, and duration.
 * STORY-103 — EPIC-010
 */
export function formatMeetingSummary(
  title: string,
  participants: string[],
  summaryText: string,
  durationSeconds?: number
): string {
  const lines: string[] = [
    '📋 M.E.R.C.U.R.Y. — Meeting Summary',
    '',
    `Meeting: ${title}`,
  ]

  if (participants.length > 0) {
    lines.push(`Participants: ${participants.join(', ')}`)
  }

  if (durationSeconds && durationSeconds > 0) {
    const mins = Math.round(durationSeconds / 60)
    lines.push(`Duration: ${mins} min`)
  }

  lines.push('', '───', '', stripMarkdown(summaryText))

  return enforceCharLimit(lines.join('\n'))
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Strip markdown formatting to plain text.
 * Handles: bold, italic, links, images, headers, code blocks, lists.
 */
function stripMarkdown(text: string): string {
  return text
    // Code blocks (``` ... ```) → keep content
    .replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/g, '').replace(/```/g, ''))
    // Inline code → keep content
    .replace(/`([^`]+)`/g, '$1')
    // Images → alt text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Links → text only
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Bold/italic (order matters: bold+italic first)
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    // Headers → plain text
    .replace(/^#{1,6}\s+/gm, '')
    // Horizontal rules
    .replace(/^[-*_]{3,}$/gm, '───')
    // Blockquotes
    .replace(/^>\s?/gm, '│ ')
    // Collapse 3+ newlines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function truncateExcerpt(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen - 1) + '…'
}

function enforceCharLimit(text: string): string {
  if (text.length <= ROAM_MAX_CHARS) return text
  const cutoff = ROAM_MAX_CHARS - TRUNCATION_MARKER.length
  return text.slice(0, cutoff) + TRUNCATION_MARKER
}
