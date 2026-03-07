/**
 * Sarah — S-P0-02: FileHoverModal tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { FileText: icon('file-text'), Calendar: icon('calendar'), HardDrive: icon('hard-drive'), Shield: icon('shield'), Hash: icon('hash') }
})

jest.mock('@/components/ui/TierBadge', () => {
  return ({ tier }: { tier: number }) => <span>Tier {tier}</span>
})

import FileHoverModal from '../FileHoverModal'

const doc = {
  id: 'd1', name: 'contract.pdf', size: 2048, type: 'pdf',
  uploadedAt: '2026-03-07T10:00:00Z', status: 'ready', securityTier: 2,
  isPrivileged: false, chunkCount: 42,
}

describe('FileHoverModal', () => {
  it('renders document name', () => {
    render(<FileHoverModal document={doc} position={{ x: 100, y: 200 }} />)
    expect(screen.getByText('contract.pdf')).toBeTruthy()
  })

  it('renders chunk count', () => {
    render(<FileHoverModal document={doc} position={{ x: 0, y: 0 }} />)
    expect(screen.getByText('42 chunks indexed')).toBeTruthy()
  })

  it('renders status', () => {
    render(<FileHoverModal document={doc} position={{ x: 0, y: 0 }} />)
    expect(screen.getByText('ready')).toBeTruthy()
  })

  it('has tooltip role', () => {
    render(<FileHoverModal document={doc} position={{ x: 0, y: 0 }} />)
    expect(screen.getByRole('tooltip')).toBeTruthy()
  })
})
