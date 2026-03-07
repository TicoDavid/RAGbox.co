/**
 * Sarah — S-P0-02: AnalystLayout tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { FileText: icon('file-text') }
})

jest.mock('../../MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}))

import { AnalystLayout } from '../AnalystLayout'

const baseProps = {
  content: 'Analysis result',
  message: { id: 'm1', role: 'assistant' as const, content: '', metadata: { docsSearched: 5, chunksEvaluated: 42 } } as never,
  onNavigateDocument: jest.fn(),
}

describe('AnalystLayout', () => {
  it('renders content via MarkdownRenderer', () => {
    render(<AnalystLayout {...baseProps} />)
    expect(screen.getByText('Analysis result')).toBeTruthy()
  })

  it('renders confidence percentage', () => {
    render(<AnalystLayout {...baseProps} confidence={0.88} />)
    expect(screen.getByText('88%')).toBeTruthy()
  })

  it('renders Sources heading', () => {
    render(<AnalystLayout {...baseProps} />)
    expect(screen.getByText('Sources')).toBeTruthy()
  })

  it('shows "No sources cited" when no citations', () => {
    render(<AnalystLayout {...baseProps} />)
    expect(screen.getByText('No sources cited')).toBeTruthy()
  })

  it('renders citation document names', () => {
    const citations = [
      { documentId: 'd1', documentName: 'Report.pdf', excerpt: 'excerpt text', citationIndex: 0 },
    ]
    render(<AnalystLayout {...baseProps} citations={citations as never} />)
    expect(screen.getByText('Report.pdf')).toBeTruthy()
  })

  it('calls onNavigateDocument on citation click', () => {
    const onNavigateDocument = jest.fn()
    const citations = [
      { documentId: 'd1', documentName: 'Report.pdf', excerpt: 'excerpt', citationIndex: 0 },
    ]
    render(<AnalystLayout {...baseProps} citations={citations as never} onNavigateDocument={onNavigateDocument} />)
    fireEvent.click(screen.getByText('Report.pdf'))
    expect(onNavigateDocument).toHaveBeenCalledWith('d1')
  })
})
