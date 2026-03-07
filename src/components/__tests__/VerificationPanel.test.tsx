/**
 * Sarah — S-P0-02: VerificationPanel tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Search: icon('search'),
    BookOpen: icon('book-open'),
    FileText: icon('file-text'),
    ExternalLink: icon('external-link'),
    Copy: icon('copy'),
    Check: icon('check'),
    X: icon('x'),
  }
})

import VerificationPanel from '../VerificationPanel'
import type { Citation } from '../VerificationPanel'

describe('VerificationPanel', () => {
  it('shows empty state when no citation', () => {
    render(<VerificationPanel citation={null} onClear={jest.fn()} />)
    expect(screen.getByText('No Active Citation')).toBeTruthy()
    expect(screen.getByText('Verification')).toBeTruthy()
  })

  it('shows citation source and text', () => {
    const citation: Citation = {
      id: 1,
      text: 'The parties agree...',
      source: 'contract.pdf',
      page: 5,
      confidence: 0.92,
    }
    render(<VerificationPanel citation={citation} onClear={jest.fn()} />)
    expect(screen.getByText(/Source \[1\]/)).toBeTruthy()
    expect(screen.getByText('contract.pdf')).toBeTruthy()
    expect(screen.getByText('The parties agree...')).toBeTruthy()
    expect(screen.getByText('Page 5')).toBeTruthy()
  })

  it('shows confidence percentage', () => {
    const citation: Citation = { id: 1, text: 'test', source: 'doc.pdf', confidence: 0.92 }
    render(<VerificationPanel citation={citation} onClear={jest.fn()} />)
    expect(screen.getByText('92%')).toBeTruthy()
  })

  it('calls onClear when clear button clicked', () => {
    const onClear = jest.fn()
    const citation: Citation = { id: 1, text: 'test', source: 'doc.pdf' }
    render(<VerificationPanel citation={citation} onClear={onClear} />)
    fireEvent.click(screen.getByTitle('Clear citation'))
    expect(onClear).toHaveBeenCalled()
  })

  it('renders verification actions', () => {
    const citation: Citation = { id: 1, text: 'test', source: 'doc.pdf' }
    render(<VerificationPanel citation={citation} onClear={jest.fn()} />)
    expect(screen.getByText('Mark as Verified')).toBeTruthy()
    expect(screen.getByText('Flag for Review')).toBeTruthy()
  })
})
