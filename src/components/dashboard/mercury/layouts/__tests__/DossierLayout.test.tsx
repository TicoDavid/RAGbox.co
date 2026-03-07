/**
 * Sarah — S-P0-02: DossierLayout tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { ChevronDown: icon('chevron-down'), ChevronRight: icon('chevron-right'), ShieldCheck: icon('shield-check') }
})

jest.mock('../../MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}))

import { DossierLayout } from '../DossierLayout'

const baseProps = {
  content: 'Answer text here',
  message: { id: 'm1', role: 'assistant' as const, content: '', createdAt: new Date().toISOString() } as never,
  onNavigateDocument: jest.fn(),
}

describe('DossierLayout', () => {
  it('renders Intelligence Briefing label', () => {
    render(<DossierLayout {...baseProps} />)
    expect(screen.getByText('Intelligence Briefing')).toBeTruthy()
  })

  it('renders content via MarkdownRenderer', () => {
    render(<DossierLayout {...baseProps} />)
    expect(screen.getByText('Answer text here')).toBeTruthy()
  })

  it('renders confidence percentage', () => {
    render(<DossierLayout {...baseProps} confidence={0.92} />)
    expect(screen.getByText('92% confidence')).toBeTruthy()
  })

  it('shows View Evidence button with citation count', () => {
    const citations = [
      { documentId: 'd1', documentName: 'Doc A', excerpt: 'text', citationIndex: 0 },
    ]
    render(<DossierLayout {...baseProps} citations={citations as never} />)
    expect(screen.getByText(/View Evidence \(1 source\)/)).toBeTruthy()
  })

  it('expands evidence on click', () => {
    const citations = [
      { documentId: 'd1', documentName: 'Doc A', excerpt: 'some excerpt', citationIndex: 0 },
    ]
    render(<DossierLayout {...baseProps} citations={citations as never} />)
    fireEvent.click(screen.getByText(/View Evidence/))
    expect(screen.getByText('Doc A')).toBeTruthy()
  })
})
