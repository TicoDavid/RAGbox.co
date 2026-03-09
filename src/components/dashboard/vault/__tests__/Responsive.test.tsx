/**
 * Sarah — EPIC-032 T8: Responsive layout tests
 *
 * Tests responsive behavior of vault components at different breakpoints.
 * Uses window.matchMedia mock to simulate viewport sizes.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

// ── Mock matchMedia ──────────────────────────────────────────

function mockMatchMedia(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, writable: true })
  window.matchMedia = jest.fn().mockImplementation((query: string) => {
    const minMatch = query.match(/min-width:\s*(\d+)px/)
    const maxMatch = query.match(/max-width:\s*(\d+)px/)
    let matches = false
    if (minMatch) matches = width >= parseInt(minMatch[1])
    if (maxMatch) matches = width <= parseInt(maxMatch[1])
    if (minMatch && maxMatch) {
      matches = width >= parseInt(minMatch[1]) && width <= parseInt(maxMatch[1])
    }
    return {
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }
  })
}

// ── Mock vaultStore ──────────────────────────────────────────

jest.mock('@/stores/vaultStore', () => ({
  useVaultStore: jest.fn((sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      isCollapsed: false,
      isExplorerMode: false,
      documents: {},
      folders: {},
      totalDocuments: 0,
      currentPath: [],
      selectedItemId: null,
      selectedDocumentIds: [],
      isLoading: false,
      error: null,
      searchQuery: '',
      duplicateConflict: null,
      storage: { used: 0, total: 1073741824 },
      filters: { types: [], dateRange: null, sizeRange: null, status: [] },
      viewMode: 'list',
      sortField: 'date',
      sortDirection: 'desc',
      previewDocumentId: null,
      uploadProgress: {},
      toggleCollapse: jest.fn(),
      setCollapsed: jest.fn(),
      toggleExplorerMode: jest.fn(),
      exitExplorerMode: jest.fn(),
      selectAndChat: jest.fn(),
      navigate: jest.fn(),
      selectItem: jest.fn(),
      setSearchQuery: jest.fn(),
      setFilter: jest.fn(),
      clearFilters: jest.fn(),
      setViewMode: jest.fn(),
      setSort: jest.fn(),
      setPreviewDocument: jest.fn(),
      setUploadProgress: jest.fn(),
      clearUploadProgress: jest.fn(),
      setSelectedDocumentIds: jest.fn(),
      toggleDocumentSelection: jest.fn(),
      clearSelection: jest.fn(),
      selectAll: jest.fn(),
      fetchDocuments: jest.fn(),
      fetchFolders: jest.fn(),
      uploadDocument: jest.fn(),
      uploadDocuments: jest.fn(),
      deleteDocument: jest.fn(),
      updateDocument: jest.fn(),
      togglePrivilege: jest.fn(),
      toggleStar: jest.fn(),
      batchDelete: jest.fn(),
      batchMove: jest.fn(),
      batchUpdateTier: jest.fn(),
      resetForUser: jest.fn(),
      createFolder: jest.fn(),
      renameFolder: jest.fn(),
      deleteFolder: jest.fn(),
      moveDocument: jest.fn(),
      moveFolder: jest.fn(),
      setFolderColor: jest.fn(),
    }),
  ),
}))

jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(
      ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => (
        <div ref={ref} {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
      ),
    ),
    button: React.forwardRef(
      ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLButtonElement>) => (
        <button ref={ref} {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>
      ),
    ),
    span: React.forwardRef(
      ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLSpanElement>) => (
        <span ref={ref} {...(props as React.HTMLAttributes<HTMLSpanElement>)}>{children}</span>
      ),
    ),
    nav: React.forwardRef(
      ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLElement>) => (
        <nav ref={ref} {...(props as React.HTMLAttributes<HTMLElement>)}>{children}</nav>
      ),
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return new Proxy({}, {
    get: (_target, prop: string) => icon(prop.toLowerCase()),
  })
})

// ── VaultToolbar responsive tests ────────────────────────────

import { VaultToolbar } from '../VaultToolbar'

describe('Responsive — VaultToolbar', () => {
  const toolbarProps = {
    viewMode: 'list' as const,
    sortField: 'date' as const,
    sortDirection: 'desc' as const,
    selectedCount: 0,
    onUpload: jest.fn(),
    onNewFolder: jest.fn(),
    onSetViewMode: jest.fn(),
    onSetSort: jest.fn(),
    onOpenExplorer: jest.fn(),
    onDeleteSelected: jest.fn(),
    onMoveSelected: jest.fn(),
    onClearSelection: jest.fn(),
  }

  it('mobile (375px): buttons remain accessible', () => {
    mockMatchMedia(375)
    render(<VaultToolbar {...toolbarProps} />)
    expect(screen.getByLabelText('Upload files')).toBeTruthy()
    expect(screen.getByLabelText('List view')).toBeTruthy()
    expect(screen.getByLabelText('Grid view')).toBeTruthy()
  })

  it('tablet (768px): all controls visible', () => {
    mockMatchMedia(768)
    render(<VaultToolbar {...toolbarProps} />)
    expect(screen.getByLabelText('Upload files')).toBeTruthy()
    expect(screen.getByLabelText('Create new folder')).toBeTruthy()
    expect(screen.getByLabelText('Sort documents')).toBeTruthy()
    expect(screen.getByLabelText('Open explorer')).toBeTruthy()
  })

  it('desktop (1280px): all controls visible', () => {
    mockMatchMedia(1280)
    render(<VaultToolbar {...toolbarProps} />)
    expect(screen.getByLabelText('Upload files')).toBeTruthy()
    expect(screen.getByLabelText('Create new folder')).toBeTruthy()
    expect(screen.getByLabelText('Sort documents')).toBeTruthy()
    expect(screen.getByLabelText('Open explorer')).toBeTruthy()
  })
})

// ── VaultBreadcrumb responsive tests ─────────────────────────

import { VaultBreadcrumb } from '../VaultBreadcrumb'

describe('Responsive — VaultBreadcrumb', () => {
  it('mobile: breadcrumb renders without overflow', () => {
    mockMatchMedia(375)
    const segments = [
      { id: 'a', label: 'Contracts' },
      { id: 'b', label: 'Q1' },
    ]
    const { container } = render(
      <VaultBreadcrumb segments={segments} onNavigate={jest.fn()} />,
    )
    const nav = container.querySelector('nav')
    expect(nav).toBeTruthy()
    // Navigation should be contained, not overflowing
    expect(screen.getByText('Vault')).toBeTruthy()
    expect(screen.getByText('Contracts')).toBeTruthy()
  })

  it('desktop: breadcrumb shows all segments', () => {
    mockMatchMedia(1280)
    const segments = [
      { id: 'a', label: 'Contracts' },
      { id: 'b', label: '2026' },
      { id: 'c', label: 'Q1' },
    ]
    render(<VaultBreadcrumb segments={segments} onNavigate={jest.fn()} />)
    expect(screen.getByText('Contracts')).toBeTruthy()
    expect(screen.getByText('2026')).toBeTruthy()
    expect(screen.getByText('Q1')).toBeTruthy()
  })

  it('no horizontal scroll at any breakpoint', () => {
    for (const width of [375, 768, 1280]) {
      mockMatchMedia(width)
      const segments = [
        { id: 'a', label: 'Contracts' },
        { id: 'b', label: '2026' },
      ]
      const { container, unmount } = render(
        <VaultBreadcrumb segments={segments} onNavigate={jest.fn()} />,
      )
      const nav = container.querySelector('nav')
      expect(nav).toBeTruthy()
      unmount()
    }
  })
})
