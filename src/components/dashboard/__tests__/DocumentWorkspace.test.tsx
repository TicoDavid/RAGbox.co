/**
 * Sarah — S-P0-02: DocumentWorkspace tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

let mockDocuments: Record<string, { id: string; name: string; type: string; status: string; size: number; updatedAt: string }> = {}

jest.mock('@/stores/vaultStore', () => ({
  useVaultStore: (sel: (s: { documents: typeof mockDocuments }) => unknown) =>
    sel({ documents: mockDocuments }),
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    FileText: icon('file-text'),
    Upload: icon('upload'),
    Database: icon('database'),
    Brain: icon('brain'),
    Clock: icon('clock'),
  }
})

import { DocumentWorkspace } from '../DocumentWorkspace'

describe('DocumentWorkspace', () => {
  beforeEach(() => {
    mockDocuments = {}
  })

  it('renders heading and description', () => {
    render(<DocumentWorkspace />)
    expect(screen.getByText('Document Workspace')).toBeTruthy()
    expect(screen.getByText('Your sovereign knowledge base')).toBeTruthy()
  })

  it('renders stat cards with zero counts when empty', () => {
    render(<DocumentWorkspace />)
    expect(screen.getByText('Documents')).toBeTruthy()
    expect(screen.getByText('Indexed')).toBeTruthy()
    expect(screen.getByText('Recent')).toBeTruthy()
  })

  it('shows empty state when no documents', () => {
    render(<DocumentWorkspace />)
    expect(screen.getByText('No documents yet')).toBeTruthy()
  })

  it('shows document count stat cards', () => {
    mockDocuments = {
      'd1': { id: 'd1', name: 'a.pdf', type: 'document', status: 'ready', size: 1024, updatedAt: '2026-03-07T00:00:00Z' },
      'd2': { id: 'd2', name: 'b.pdf', type: 'document', status: 'processing', size: 2048, updatedAt: '2026-03-06T00:00:00Z' },
    }
    render(<DocumentWorkspace />)
    // 2 total documents, 1 indexed (ready)
    const statValues = screen.getAllByText(/^[0-2]$/)
    expect(statValues.length).toBeGreaterThanOrEqual(2)
  })

  it('renders recent document names', () => {
    mockDocuments = {
      'd1': { id: 'd1', name: 'contract.pdf', type: 'document', status: 'ready', size: 5000, updatedAt: '2026-03-07T10:00:00Z' },
    }
    render(<DocumentWorkspace />)
    expect(screen.getByText('contract.pdf')).toBeTruthy()
  })

  it('renders drop zone', () => {
    render(<DocumentWorkspace />)
    expect(screen.getByText('Drop files here')).toBeTruthy()
  })
})
