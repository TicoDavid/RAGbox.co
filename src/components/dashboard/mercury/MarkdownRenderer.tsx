'use client'

import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

/**
 * MarkdownRenderer — STORY-239: Perplexity-Style Response Layout
 *
 * Shared component for rendering Mercury/Chat responses with:
 * - Typography: #E6F1FF primary, #8892B0 secondary, Inter, 1.7+ line-height
 * - Inline citation chips: [1], [2] → styled superscript badges
 * - Section spacing: 16px+ paragraphs, 24px+ before headers
 * - TL;DR summary for long responses (>300 words)
 */

interface MarkdownRendererProps {
  content: string
  onCitationClick?: (index: number) => void
}

const WORD_THRESHOLD = 300

/**
 * Transform inline citation markers [1], [2] etc. into styled chips.
 * Returns React elements with citation badges interspersed with text.
 */
function renderWithCitations(
  text: string,
  onCitationClick?: (index: number) => void,
): React.ReactNode[] {
  const parts = text.split(/(\[\d+\])/)
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/)
    if (match) {
      const idx = parseInt(match[1], 10)
      return (
        <button
          key={i}
          onClick={() => onCitationClick?.(idx)}
          className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[var(--brand-blue)]/20 text-[var(--brand-blue)] text-[9px] font-bold ml-0.5 -translate-y-1 hover:bg-[var(--brand-blue)]/30 transition-colors cursor-pointer align-baseline"
          title={`Source ${idx}`}
        >
          {idx}
        </button>
      )
    }
    return part ? <React.Fragment key={i}>{part}</React.Fragment> : null
  })
}

function generateTldr(content: string): string | null {
  const words = content.trim().split(/\s+/)
  if (words.length < WORD_THRESHOLD) return null

  // Extract first sentence or first ~30 words as summary
  const firstSentence = content.match(/^[^.!?]+[.!?]/)
  if (firstSentence && firstSentence[0].split(/\s+/).length <= 40) {
    return firstSentence[0].trim()
  }
  return words.slice(0, 30).join(' ') + '...'
}

export function MarkdownRenderer({ content, onCitationClick }: MarkdownRendererProps) {
  const tldr = useMemo(() => generateTldr(content), [content])

  const mdComponents: Components = useMemo(() => ({
    h1: ({ children }) => (
      <h1 className="text-lg font-bold mt-6 mb-3 text-[#E6F1FF] first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-base font-semibold mt-5 mb-2.5 text-[#E6F1FF] first:mt-0">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-sm font-semibold mt-4 mb-2 text-[#E6F1FF] first:mt-0">
        {children}
      </h3>
    ),
    p: ({ children }) => {
      // Transform string children to include citation chips
      const transformed = React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          return renderWithCitations(child, onCitationClick)
        }
        return child
      })
      return (
        <p className="mb-4 text-[#E6F1FF] leading-[1.75] last:mb-0">
          {transformed}
        </p>
      )
    },
    ul: ({ children }) => (
      <ul className="list-disc pl-5 mb-4 space-y-1.5">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-5 mb-4 space-y-1.5">{children}</ol>
    ),
    li: ({ children }) => {
      const transformed = React.Children.map(children, (child) => {
        if (typeof child === 'string') {
          return renderWithCitations(child, onCitationClick)
        }
        return child
      })
      return (
        <li className="text-[#8892B0] leading-[1.7]">
          {transformed}
        </li>
      )
    },
    strong: ({ children }) => (
      <strong className="font-semibold text-[#E6F1FF]">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-[#8892B0]">{children}</em>
    ),
    code: ({ children, className }) => {
      const isBlock = className?.includes('language-')
      return isBlock ? (
        <pre className="bg-[var(--bg-tertiary)] rounded-lg p-4 overflow-x-auto my-4">
          <code className="text-sm font-mono text-[var(--success)]">{children}</code>
        </pre>
      ) : (
        <code className="bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded text-sm font-mono text-[var(--brand-blue)]">{children}</code>
      )
    },
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-[var(--border-default)] px-3 py-2 text-left bg-[var(--bg-secondary)] font-semibold text-[#E6F1FF]">{children}</th>
    ),
    td: ({ children }) => (
      <td className="border border-[var(--border-default)] px-3 py-2 text-[#8892B0]">{children}</td>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-3 border-[var(--brand-blue)] pl-4 italic text-[#8892B0] my-4">{children}</blockquote>
    ),
  }), [onCitationClick])

  return (
    <div className="font-[var(--font-inter)] text-sm">
      {/* TL;DR summary for long responses */}
      {tldr && (
        <div className="mb-4 pb-3 border-b border-[var(--border-subtle)]">
          <p className="text-xs text-[#8892B0] italic leading-relaxed">
            <span className="font-semibold text-[var(--text-tertiary)] uppercase tracking-wider text-[10px] not-italic mr-1.5">
              TL;DR
            </span>
            {tldr}
          </p>
        </div>
      )}

      {/* Main markdown content */}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
