/**
 * ROAM Block Kit Response Builder
 *
 * Builds rich Block Kit formatted responses for ROAM chat.post v0 API.
 *
 * Block Kit constraints:
 *   - Max 10 blocks per message
 *   - Max 8KB payload
 *   - `blocks` and `text` are mutually exclusive
 *   - Uses Slack-compatible mrkdwn (*bold*, _italic_)
 *
 * Text formatting rules for ROAM:
 *   - \n → \n\n (ROAM requires double newlines for line breaks)
 *   - Strip code blocks > 500 chars (truncate with "see full response" link)
 *   - Convert [1] citations to readable format
 *   - Use *bold* and _italic_ (not **bold** / _italic_)
 *
 * EPIC-018 S05
 */

import type { Citation } from '@/types/ragbox'

// ── Types ──────────────────────────────────────────────────────────

interface TextObject {
  type: 'mrkdwn' | 'plain_text'
  text: string
}

interface SectionBlock {
  type: 'section'
  text: TextObject
}

interface ContextBlock {
  type: 'context'
  elements: TextObject[]
}

interface ButtonElement {
  type: 'button'
  text: TextObject
  action_id?: string
  url?: string
  value?: string
  style?: 'primary' | 'danger'
}

interface ActionsBlock {
  type: 'actions'
  elements: ButtonElement[]
}

type Block = SectionBlock | ContextBlock | ActionsBlock

export interface BlockKitResponse {
  blocks: Block[]
  color: string
}

// ── Constants ──────────────────────────────────────────────────────

const MAX_BLOCKS = 10
const MAX_CODE_BLOCK_LEN = 500
const VAULT_URL = 'https://app.ragbox.co/vault'

// ── Public API ─────────────────────────────────────────────────────

/**
 * Build a Block Kit response from a Mercury RAG answer.
 *
 * @param answer       Mercury answer text (markdown)
 * @param citations    Citation objects from RAG pipeline
 * @param confidence   Confidence score 0-1
 * @param queryId      Query UUID for feedback button value
 * @param isSilence    Whether this is a Silence Protocol response
 */
export function buildBlockKitResponse(
  answer: string,
  citations: Citation[],
  confidence?: number,
  queryId?: string,
  isSilence?: boolean
): BlockKitResponse {
  const blocks: Block[] = []

  // Block 1: Main answer section
  const formattedAnswer = formatForMrkdwn(answer)
  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: formattedAnswer },
  })

  // Block 2: Context — sources + confidence
  const contextParts: string[] = []

  if (citations.length > 0) {
    const citationList = citations
      .slice(0, 5) // Max 5 citations in context line
      .map(c => c.documentName || `Doc ${c.citationIndex}`)
      .join(', ')
    contextParts.push(`Sources: ${citationList}`)
  }

  if (confidence !== undefined) {
    contextParts.push(`Confidence: ${Math.round(confidence * 100)}%`)
  }

  if (contextParts.length > 0) {
    blocks.push({
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: contextParts.join(' · ') },
      ],
    })
  }

  // Block 3: Actions — buttons
  if (!isSilence) {
    const elements: ButtonElement[] = [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View Sources' },
        url: VAULT_URL,
      },
    ]

    if (queryId) {
      elements.push({
        type: 'button',
        text: { type: 'plain_text', text: '👍 Helpful' },
        action_id: 'feedback_positive',
        value: queryId,
        style: 'primary',
      })
    }

    blocks.push({
      type: 'actions',
      elements,
    })
  }

  // Enforce max blocks limit
  const trimmedBlocks = blocks.slice(0, MAX_BLOCKS)

  // Color: green for confident, yellow for low confidence, red for silence
  let color = 'good'
  if (isSilence) {
    color = 'danger'
  } else if (confidence !== undefined && confidence < 0.75) {
    color = 'warning'
  }

  return { blocks: trimmedBlocks, color }
}

// ── Text Formatting ────────────────────────────────────────────────

/**
 * Convert standard markdown to ROAM-compatible mrkdwn format.
 *
 * Rules:
 *   - \n → \n\n (ROAM requires double newlines for line breaks)
 *   - Strip code blocks > 500 chars
 *   - Convert **bold** → *bold*
 *   - Keep _italic_ as-is (compatible)
 *   - Convert [1] citations to readable format
 */
export function formatForMrkdwn(text: string): string {
  let result = text

  // Strip code blocks longer than 500 chars
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    const content = match.replace(/```\w*\n?/g, '').replace(/```/g, '')
    if (content.length > MAX_CODE_BLOCK_LEN) {
      return `\`${content.slice(0, MAX_CODE_BLOCK_LEN)}…\`\n_… see full response in RAGbox_`
    }
    return `\`\`\`${content}\`\`\``
  })

  // Convert **bold** → *bold* (ROAM uses Slack-style single asterisk)
  result = result.replace(/\*\*(.+?)\*\*/g, '*$1*')

  // Convert [N] inline citations to readable format
  result = result.replace(/\[(\d+)\]/g, '[$1]')

  // Convert \n to \n\n (ROAM requires double newlines for line breaks)
  // But don't double existing double newlines
  result = result.replace(/(?<!\n)\n(?!\n)/g, '\n\n')

  return result
}
