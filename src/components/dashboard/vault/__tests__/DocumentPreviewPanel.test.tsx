/**
 * Sarah — EPIC-032 T4: DocumentPreviewPanel tests
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── Mock vaultStore ──────────────────────────────────────────

const mockUpdateDocument = jest.fn()
const mockToggleStar = jest.fn()
const mockTogglePrivilege = jest.fn()
const mockFetchDocuments = jest.fn()

let mockDocuments: Record<string, unknown> = {}
const mockFolders: Record<string, unknown> = {}

jest.mock('@/stores/vaultStore', () => ({
  useVaultStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      documents: mockDocuments,
      folders: mockFolders,
      updateDocument: mockUpdateDocument,
      toggleStar: mockToggleStar,
      togglePrivilege: mockTogglePrivilege,
      fetchDocuments: mockFetchDocuments,
    }),
}))

// ── Mock apiFetch ────────────────────────────────────────────

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
}))

// ── Mock framer-motion ───────────────────────────────────────

jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(
      ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => (
        <div ref={ref} {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
      ),
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    X: icon('x'),
    Eye: icon('eye'),
    Info: icon('info'),
    History: icon('history'),
    FileText: icon('file-text'),
    Download: icon('download'),
    Loader2: icon('loader'),
    Users: icon('users'),
  }
})

// ── Mock child components ────────────────────────────────────

jest.mock('../DocumentDetailsTab', () => ({
  DocumentDetailsTab: ({ document: doc }: { document: { name: string } }) => (
    <div data-testid="details-tab">{doc.name} details</div>
  ),
}))

jest.mock('../DocumentHistoryTab', () => ({
  DocumentHistoryTab: ({ documentId }: { documentId: string }) => (
    <div data-testid="history-tab">History for {documentId}</div>
  ),
}))

jest.mock('../PipelineStatusIndicator', () => ({
  PipelineStatusIndicator: () => <div data-testid="pipeline-status" />,
}))

jest.mock('../EntityPreview', () => ({
  EntityPreview: () => <div data-testid="entity-preview" />,
}))

import { DocumentPreviewPanel } from '../DocumentPreviewPanel'

const VALID_CUID = 'cm1234567890abcdefghijklmn'

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_CUID,
    name: 'contract.pdf',
    originalName: 'contract.pdf',
    type: 'document',
    mimeType: 'application/pdf',
    size: 2048,
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'Indexed',
    isPrivileged: false,
    isStarred: false,
    securityTier: 1,
    deletionStatus: 'Active',
    ...overrides,
  }
}

describe('DocumentPreviewPanel', () => {
  const mockClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockDocuments = { [VALID_CUID]: makeDoc() }
  })

  it('renders panel when documentId is set', () => {
    render(<DocumentPreviewPanel documentId={VALID_CUID} onClose={mockClose} />)
    expect(screen.getByText('contract.pdf')).toBeTruthy()
  })

  it('close button dismisses panel', () => {
    render(<DocumentPreviewPanel documentId={VALID_CUID} onClose={mockClose} />)
    fireEvent.click(screen.getByLabelText('Close preview'))
    expect(mockClose).toHaveBeenCalled()
  })

  it('Escape key closes panel', () => {
    render(<DocumentPreviewPanel documentId={VALID_CUID} onClose={mockClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(mockClose).toHaveBeenCalled()
  })

  it('tab bar shows Preview, Details, History tabs', () => {
    render(<DocumentPreviewPanel documentId={VALID_CUID} onClose={mockClose} />)
    expect(screen.getByText('Preview')).toBeTruthy()
    expect(screen.getByText('Details')).toBeTruthy()
    expect(screen.getByText('History')).toBeTruthy()
  })

  it('preview tab renders PDF iframe for PDF documents', () => {
    render(<DocumentPreviewPanel documentId={VALID_CUID} onClose={mockClose} />)
    const iframe = document.querySelector('iframe')
    expect(iframe).toBeTruthy()
    expect(iframe?.getAttribute('title')).toBe('PDF preview')
  })

  it('preview tab renders image for image documents', () => {
    mockDocuments = { [VALID_CUID]: makeDoc({ mimeType: 'image/png' }) }
    render(<DocumentPreviewPanel documentId={VALID_CUID} onClose={mockClose} />)
    const img = document.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('alt')).toBe('Document preview')
  })

  it('preview tab shows "Preview not available" for unsupported types', () => {
    mockDocuments = { [VALID_CUID]: makeDoc({ mimeType: 'application/zip' }) }
    render(<DocumentPreviewPanel documentId={VALID_CUID} onClose={mockClose} />)
    expect(screen.getByText('Preview not available')).toBeTruthy()
  })

  it('details tab shows document metadata', () => {
    render(<DocumentPreviewPanel documentId={VALID_CUID} onClose={mockClose} />)
    fireEvent.click(screen.getByText('Details'))
    expect(screen.getByTestId('details-tab')).toBeTruthy()
    expect(screen.getByText('contract.pdf details')).toBeTruthy()
  })

  it('history tab fetches and displays audit entries', () => {
    render(<DocumentPreviewPanel documentId={VALID_CUID} onClose={mockClose} />)
    fireEvent.click(screen.getByText('History'))
    expect(screen.getByTestId('history-tab')).toBeTruthy()
    expect(screen.getByText(`History for ${VALID_CUID}`)).toBeTruthy()
  })

  it('panel does not render when documentId is null', () => {
    const { container } = render(
      <DocumentPreviewPanel documentId={null} onClose={mockClose} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('panel does not render for invalid CUID', () => {
    const { container } = render(
      <DocumentPreviewPanel documentId="invalid-id" onClose={mockClose} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders audio player for audio documents', () => {
    mockDocuments = { [VALID_CUID]: makeDoc({ mimeType: 'audio/mp3' }) }
    render(<DocumentPreviewPanel documentId={VALID_CUID} onClose={mockClose} />)
    const audio = document.querySelector('audio')
    expect(audio).toBeTruthy()
  })
})
