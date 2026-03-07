/**
 * Sarah — S-P0-02: CitationChip tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import CitationChip from '../CitationChip'

describe('CitationChip', () => {
  const props = {
    index: 3,
    documentName: 'contract.pdf',
    excerpt: 'The parties agree to the terms...',
    relevanceScore: 0.91,
    securityTier: 2,
  }

  it('renders citation index', () => {
    render(<CitationChip {...props} />)
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('sets title with document name and score', () => {
    render(<CitationChip {...props} />)
    const btn = screen.getByRole('button')
    expect(btn.getAttribute('title')).toBe('contract.pdf (91% match)')
  })

  it('shows tooltip on hover with document name', () => {
    render(<CitationChip {...props} />)
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByText('contract.pdf')).toBeTruthy()
    expect(screen.getByText(/91% relevance/)).toBeTruthy()
  })

  it('hides tooltip on mouse leave', () => {
    render(<CitationChip {...props} />)
    fireEvent.mouseEnter(screen.getByRole('button'))
    expect(screen.getByText('contract.pdf')).toBeTruthy()
    fireEvent.mouseLeave(screen.getByRole('button'))
    expect(screen.queryByText('contract.pdf')).toBeNull()
  })

  it('calls onClick when clicked', () => {
    const onClick = jest.fn()
    render(<CitationChip {...props} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })
})
