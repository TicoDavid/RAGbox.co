/**
 * @jest-environment jsdom
 */

/**
 * EPIC-011 STORY-120 Block 1: Vault Explorer Tests
 *
 * Test tree navigation, search, empty states, and casing.
 *
 * — Sarah, Engineering
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mock lucide-react (catch-all proxy) ──────────────────────────
jest.mock('lucide-react', () => {
  return new Proxy({}, {
    get: (_target, prop) => {
      if (typeof prop !== 'string') return undefined
      return React.forwardRef(({ className, ...rest }: Record<string, unknown>, ref: React.Ref<SVGSVGElement>) =>
        React.createElement('svg', { 'data-testid': `icon-${prop}`, className, ref, ...rest }),
      )
    },
  })
})

// ── Mock zustand stores ──────────────────────────────────────────
const mockExitExplorerMode = jest.fn()
const mockSelectAndChat = jest.fn()
const mockUploadDocuments = jest.fn()
const mockDeleteDocument = jest.fn()
const mockNavigate = jest.fn()
const mockStartDocumentChat = jest.fn()

const MOCK_DOCUMENTS: Record<string, Record<string, unknown>> = {
  'doc-1': {
    id: 'doc-1', name: 'Contract.pdf', originalName: 'Contract.pdf',
    type: 'document', size: 1024000, createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-02-01'), status: 'Indexed',
    isPrivileged: false, isStarred: false, securityTier: 1, deletionStatus: 'Active',
  },
  'doc-2': {
    id: 'doc-2', name: 'Meeting-Notes.docx', originalName: 'Meeting-Notes.docx',
    type: 'document', size: 512000, createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-02-10'), status: 'Indexed',
    isPrivileged: false, isStarred: false, securityTier: 1, deletionStatus: 'Active',
  },
  'doc-3': {
    id: 'doc-3', name: 'Budget.xlsx', originalName: 'Budget.xlsx',
    type: 'document', size: 256000, createdAt: new Date('2026-01-20'),
    updatedAt: new Date('2026-02-15'), folderId: 'folder-1', status: 'Indexed',
    isPrivileged: false, isStarred: false, securityTier: 2, deletionStatus: 'Active',
  },
}

const MOCK_FOLDERS: Record<string, Record<string, unknown>> = {
  'folder-1': { id: 'folder-1', name: 'Legal', children: ['folder-2'], documents: ['doc-3'] },
  'folder-2': { id: 'folder-2', name: 'Contracts', parentId: 'folder-1', children: [], documents: [] },
}

let mockVaultState: Record<string, unknown>

jest.mock('@/stores/vaultStore', () => ({
  useVaultStore: (selector: (state: Record<string, unknown>) => unknown) => selector(mockVaultState),
}))

jest.mock('@/stores/chatStore', () => ({
  useChatStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    startDocumentChat: mockStartDocumentChat,
  }),
}))

// ── Mock child components ────────────────────────────────────────
jest.mock('@/app/dashboard/components/IngestionModal', () => ({
  __esModule: true,
  default: () => null,
}))

jest.mock('../VaultAccessModal', () => ({
  VaultAccessModal: () => null,
}))

jest.mock('../security', () => ({
  tierToSecurity: (tier: number) => (['general', 'general', 'sensitive', 'confidential', 'sovereign'][tier] || 'general'),
  SecurityBadge: ({ security }: { security: string }) =>
    React.createElement('span', { 'data-testid': 'security-badge' }, security),
  SecurityDropdown: () => React.createElement('div', { 'data-testid': 'security-dropdown' }),
  RagIndexToggle: () => React.createElement('div', { 'data-testid': 'rag-toggle' }),
}))

import { VaultExplorer } from '../VaultExplorer'

describe('VaultExplorer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockVaultState = {
      documents: MOCK_DOCUMENTS,
      folders: MOCK_FOLDERS,
      exitExplorerMode: mockExitExplorerMode,
      selectAndChat: mockSelectAndChat,
      uploadDocuments: mockUploadDocuments,
      deleteDocument: mockDeleteDocument,
      currentPath: [],
      navigate: mockNavigate,
    }
  })

  it('renders Vault breadcrumb and All Files in navigation tree', () => {
    render(<VaultExplorer />)
    expect(screen.getByText('Vault')).toBeInTheDocument()
    expect(screen.getByText('All Files')).toBeInTheDocument()
    expect(screen.getByText('Folders')).toBeInTheDocument()
  })

  it('renders folder tree with store folders', () => {
    render(<VaultExplorer />)
    // Legal appears in both tree nav and file table
    expect(screen.getAllByText('Legal').length).toBeGreaterThanOrEqual(1)
  })

  it('renders root documents only (subfolder docs excluded)', () => {
    render(<VaultExplorer />)
    // Root docs (no folderId)
    expect(screen.getByText('Contract.pdf')).toBeInTheDocument()
    expect(screen.getByText('Meeting-Notes.docx')).toBeInTheDocument()
    // doc-3 is in folder-1 — should not appear at root
    expect(screen.queryByText('Budget.xlsx')).not.toBeInTheDocument()
  })

  it('clicking folder in tree nav calls navigate with correct path', () => {
    render(<VaultExplorer />)
    // Legal appears in tree nav AND as a folder row in table — click tree nav (first)
    const legalElements = screen.getAllByText('Legal')
    fireEvent.click(legalElements[0])
    expect(mockNavigate).toHaveBeenCalledWith(['folder-1'])
  })

  it('search filters documents by name', () => {
    render(<VaultExplorer />)
    const searchInput = screen.getByPlaceholderText('Search...')
    fireEvent.change(searchInput, { target: { value: 'Contract' } })
    expect(screen.getByText('Contract.pdf')).toBeInTheDocument()
    expect(screen.queryByText('Meeting-Notes.docx')).not.toBeInTheDocument()
  })

  it('clearing search restores all documents', () => {
    render(<VaultExplorer />)
    const searchInput = screen.getByPlaceholderText('Search...')
    fireEvent.change(searchInput, { target: { value: 'Contract' } })
    expect(screen.queryByText('Meeting-Notes.docx')).not.toBeInTheDocument()
    fireEvent.change(searchInput, { target: { value: '' } })
    expect(screen.getByText('Contract.pdf')).toBeInTheDocument()
    expect(screen.getByText('Meeting-Notes.docx')).toBeInTheDocument()
  })

  it('shows empty state with upload prompt when folder is empty', () => {
    mockVaultState = { ...mockVaultState, documents: {}, folders: {} }
    render(<VaultExplorer />)
    expect(screen.getByText('This folder is empty')).toBeInTheDocument()
    // Add Files button in empty state + toolbar
    expect(screen.getAllByText('Add Files').length).toBeGreaterThanOrEqual(1)
  })

  it('shows "No files match your search" for unmatched query', () => {
    render(<VaultExplorer />)
    const searchInput = screen.getByPlaceholderText('Search...')
    fireEvent.change(searchInput, { target: { value: 'zzzznonexistent' } })
    expect(screen.getByText('No files match your search')).toBeInTheDocument()
  })

  it('uses correct "Vault" casing — no VAULT or vault in visible text', () => {
    render(<VaultExplorer />)
    // Correct casing present
    expect(screen.getByText('Vault')).toBeInTheDocument()
    // Wrong casings absent
    expect(screen.queryByText('VAULT')).not.toBeInTheDocument()
    expect(screen.queryByText(/^vault$/)).not.toBeInTheDocument()
  })
})
