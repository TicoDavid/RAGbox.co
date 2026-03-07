/**
 * Sarah — S-P0-02: ListView tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { FileText: icon('file-text'), Lock: icon('lock'), Trash2: icon('trash') }
})

jest.mock('@/components/ui/TierBadge', () => {
  return ({ tier }: { tier: number }) => <span data-testid={`tier-${tier}`}>T{tier}</span>
})

import ListView from '../ListView'

const docs = [
  { id: 'd1', name: 'report.pdf', size: 1024, type: 'pdf', uploadedAt: '2026-03-07T10:00:00Z', status: 'ready', securityTier: 1, isPrivileged: false },
]

describe('ListView', () => {
  const baseProps = { documents: docs, sortField: 'date' as const, sortOrder: 'desc' as const, onSort: jest.fn(), onSelect: jest.fn(), onDelete: jest.fn() }

  it('renders document name', () => {
    render(<ListView {...baseProps} />)
    expect(screen.getByText('report.pdf')).toBeTruthy()
  })

  it('renders sort buttons', () => {
    render(<ListView {...baseProps} />)
    expect(screen.getByLabelText('Sort by name')).toBeTruthy()
    expect(screen.getByLabelText('Sort by size')).toBeTruthy()
    expect(screen.getByLabelText('Sort by date')).toBeTruthy()
  })

  it('calls onSort when header clicked', () => {
    const onSort = jest.fn()
    render(<ListView {...baseProps} onSort={onSort} />)
    fireEvent.click(screen.getByLabelText('Sort by name'))
    expect(onSort).toHaveBeenCalledWith('name')
  })

  it('calls onSelect when row clicked', () => {
    const onSelect = jest.fn()
    render(<ListView {...baseProps} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('report.pdf'))
    expect(onSelect).toHaveBeenCalledWith('d1')
  })

  it('shows empty state', () => {
    render(<ListView {...baseProps} documents={[]} />)
    expect(screen.getByText('No documents found')).toBeTruthy()
  })

  it('shows delete button', () => {
    const onDelete = jest.fn()
    render(<ListView {...baseProps} onDelete={onDelete} />)
    fireEvent.click(screen.getByLabelText('Delete report.pdf'))
    expect(onDelete).toHaveBeenCalledWith('d1')
  })
})
