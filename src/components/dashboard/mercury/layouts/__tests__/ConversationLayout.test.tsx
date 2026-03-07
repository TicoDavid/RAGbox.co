/**
 * Sarah — S-P0-02: ConversationLayout tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('../../MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}))

import { ConversationLayout } from '../ConversationLayout'

const baseProps = {
  content: 'Hello world',
  message: { id: 'm1', role: 'assistant' as const, content: '' } as never,
  onNavigateDocument: jest.fn(),
}

describe('ConversationLayout', () => {
  it('renders content via MarkdownRenderer', () => {
    render(<ConversationLayout {...baseProps} />)
    expect(screen.getByText('Hello world')).toBeTruthy()
  })

  it('renders citation chips', () => {
    const citations = [
      { documentId: 'd1', documentName: 'Contract.pdf', excerpt: 'text', citationIndex: 0 },
    ]
    render(<ConversationLayout {...baseProps} citations={citations as never} />)
    expect(screen.getByText('Contract.pdf')).toBeTruthy()
  })

  it('renders citation index', () => {
    const citations = [
      { documentId: 'd1', documentName: 'Doc', excerpt: 'text', citationIndex: 0 },
    ]
    render(<ConversationLayout {...baseProps} citations={citations as never} />)
    expect(screen.getByText('[1]')).toBeTruthy()
  })

  it('calls onNavigateDocument on citation click', () => {
    const onNavigateDocument = jest.fn()
    const citations = [
      { documentId: 'd1', documentName: 'Doc', excerpt: 'text', citationIndex: 0 },
    ]
    render(<ConversationLayout {...baseProps} citations={citations as never} onNavigateDocument={onNavigateDocument} />)
    fireEvent.click(screen.getByText('Doc'))
    expect(onNavigateDocument).toHaveBeenCalledWith('d1')
  })
})
