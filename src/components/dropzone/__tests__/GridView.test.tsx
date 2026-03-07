/**
 * Sarah — S-P0-02: GridView tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { FileText: icon('file-text'), Lock: icon('lock') }
})

jest.mock('@/components/ui/TierBadge', () => {
  return ({ tier }: { tier: number }) => <span data-testid={`tier-${tier}`}>T{tier}</span>
})

import GridView from '../GridView'

const docs = [
  { id: 'd1', name: 'report.pdf', size: 5242880, type: 'pdf', uploadedAt: '2026-03-07', status: 'ready', securityTier: 2, isPrivileged: false },
]

describe('GridView', () => {
  it('renders document name', () => {
    render(<GridView documents={docs} onSelect={jest.fn()} />)
    expect(screen.getByText('report.pdf')).toBeTruthy()
  })

  it('shows empty state when no documents', () => {
    render(<GridView documents={[]} onSelect={jest.fn()} />)
    expect(screen.getByText('No documents found')).toBeTruthy()
  })

  it('calls onSelect when document clicked', () => {
    const onSelect = jest.fn()
    render(<GridView documents={docs} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('report.pdf'))
    expect(onSelect).toHaveBeenCalledWith('d1')
  })

  it('renders tier badge', () => {
    render(<GridView documents={docs} onSelect={jest.fn()} />)
    expect(screen.getByTestId('tier-2')).toBeTruthy()
  })
})
