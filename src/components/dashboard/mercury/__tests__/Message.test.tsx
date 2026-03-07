/**
 * Sarah — S-P0-02: Message component tests
 *
 * Covers: user vs assistant rendering, JSON guard parsing,
 * citation cards, confidence badge, model badge, action buttons.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import type { ChatMessage } from '@/types/ragbox'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Copy: icon('copy'),
    Check: icon('check'),
    ThumbsUp: icon('thumbsup'),
    ThumbsDown: icon('thumbsdown'),
    Share2: icon('share'),
    FileText: icon('filetext'),
    ExternalLink: icon('external'),
  }
})

jest.mock('../MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}))

jest.mock('../ConfidenceBadge', () => ({
  ConfidenceBadge: ({ confidence }: { confidence: number }) => (
    <span data-testid="confidence">{Math.round(confidence * 100)}%</span>
  ),
}))

jest.mock('../ModelBadge', () => ({
  ModelBadge: ({ modelUsed }: { modelUsed?: string }) => (
    modelUsed ? <span data-testid="model-badge">{modelUsed}</span> : null
  ),
}))

import { Message, extractProse } from '../Message'

const makeMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'msg-1',
  role: 'assistant',
  content: 'Test response',
  timestamp: new Date('2026-03-07T10:00:00'),
  ...overrides,
})

describe('Message', () => {
  it('renders user message in right-aligned bubble', () => {
    const { container } = render(
      <Message message={makeMessage({ role: 'user', content: 'Hello' })} />
    )
    expect(container.textContent).toContain('Hello')
    expect(container.querySelector('.justify-end')).toBeTruthy()
  })

  it('renders assistant message with MarkdownRenderer', () => {
    render(<Message message={makeMessage({ content: 'AI answer' })} />)
    expect(screen.getByTestId('markdown')).toBeTruthy()
    expect(screen.getByText('AI answer')).toBeTruthy()
  })

  it('renders timestamp', () => {
    render(<Message message={makeMessage()} />)
    expect(screen.getByText('10:00 AM')).toBeTruthy()
  })

  it('renders confidence badge when present', () => {
    render(<Message message={makeMessage({ confidence: 0.92 })} />)
    expect(screen.getByTestId('confidence')).toBeTruthy()
    expect(screen.getByText('92%')).toBeTruthy()
  })

  it('renders model badge when present', () => {
    render(<Message message={makeMessage({ modelUsed: 'gpt-4o' })} />)
    expect(screen.getByTestId('model-badge')).toBeTruthy()
  })

  it('renders source cards when citations present', () => {
    render(
      <Message
        message={makeMessage({
          citations: [
            { citationIndex: 1, documentName: 'doc.pdf', excerpt: 'text', relevanceScore: 0.9, documentId: 'd1', chunkId: 'c1' },
          ],
        })}
      />
    )
    expect(screen.getByText('Sources')).toBeTruthy()
    expect(screen.getByText('doc.pdf')).toBeTruthy()
  })

  it('applies error styling when isError is true', () => {
    const { container } = render(<Message message={makeMessage({ isError: true })} />)
    expect(container.querySelector('.border')?.className).toContain('danger')
  })

  it('renders action buttons (copy, thumbs, share)', () => {
    render(<Message message={makeMessage()} />)
    expect(screen.getByTitle('Copy')).toBeTruthy()
    expect(screen.getByTitle('Helpful')).toBeTruthy()
    expect(screen.getByTitle('Not helpful')).toBeTruthy()
    expect(screen.getByTitle('Share')).toBeTruthy()
  })
})

describe('extractProse', () => {
  it('extracts answer from JSON string', () => {
    const json = JSON.stringify({ answer: 'Extracted text', citations: [] })
    expect(extractProse(json)).toBe('Extracted text')
  })

  it('returns raw text when not JSON', () => {
    expect(extractProse('Just plain text')).toBe('Just plain text')
  })

  it('handles JSON wrapped in code fences', () => {
    const fenced = '```json\n{"answer": "fenced"}\n```'
    expect(extractProse(fenced)).toBe('fenced')
  })
})
