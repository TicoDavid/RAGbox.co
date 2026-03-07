/**
 * Sarah — S-P0-02: CitationTag tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { CitationTag } from '../CitationTag'
import type { Citation } from '@/types/ragbox'

const mockCitation: Citation = {
  citationIndex: 3,
  documentName: 'contract.pdf',
  excerpt: 'The parties agree...',
  relevanceScore: 0.92,
  documentId: 'doc-1',
  chunkId: 'chunk-1',
}

describe('CitationTag', () => {
  it('renders citation index in brackets', () => {
    render(<CitationTag citation={mockCitation} />)
    expect(screen.getByText('[3]')).toBeTruthy()
  })

  it('renders document name', () => {
    render(<CitationTag citation={mockCitation} />)
    expect(screen.getByText('contract.pdf')).toBeTruthy()
  })

  it('sets excerpt as title tooltip', () => {
    render(<CitationTag citation={mockCitation} />)
    const button = screen.getByRole('button')
    expect(button.getAttribute('title')).toBe('The parties agree...')
  })

  it('calls onClick with citation when clicked', () => {
    const onClick = jest.fn()
    render(<CitationTag citation={mockCitation} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledWith(mockCitation)
  })

  it('does not crash when onClick is not provided', () => {
    render(<CitationTag citation={mockCitation} />)
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow()
  })
})
