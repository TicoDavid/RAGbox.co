import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

// ── Mocks ──────────────────────────────────────────────────────

const mockFetchDocuments = jest.fn().mockResolvedValue(undefined)
const mockFetchFolders = jest.fn().mockResolvedValue(undefined)
const mockToggleCollapse = jest.fn()

let mockIsCollapsed = false

jest.mock('@/stores/vaultStore', () => ({
  useVaultStore: jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      isCollapsed: mockIsCollapsed,
      toggleCollapse: mockToggleCollapse,
      toggleExplorerMode: jest.fn(),
      fetchDocuments: mockFetchDocuments,
      fetchFolders: mockFetchFolders,
      uploadDocument: jest.fn(),
      uploadDocuments: jest.fn(),
      deleteDocument: jest.fn(),
      createFolder: jest.fn(),
      navigate: jest.fn(),
      currentPath: [],
      selectedItemId: null,
      isLoading: false,
      documents: {},
      folders: {},
      searchQuery: '',
      setSearchQuery: jest.fn(),
      // E32 additions
      filters: { types: [], dateRange: null, sizeRange: null, status: [] },
      setFilter: jest.fn(),
      clearFilters: jest.fn(),
      viewMode: 'list',
      sortField: 'date',
      sortDirection: 'desc',
      setViewMode: jest.fn(),
      setSort: jest.fn(),
      previewDocumentId: null,
      setPreviewDocument: jest.fn(),
      selectedDocumentIds: [],
      clearSelection: jest.fn(),
    }),
  ),
}))

jest.mock('./VaultRail', () => ({
  VaultRail: (props: { onExpand: () => void }) => (
    <div data-testid="vault-rail" onClick={props.onExpand} />
  ),
}))

jest.mock('./ColumnBrowser', () => ({
  ColumnBrowser: () => <div data-testid="column-browser" />,
}))

jest.mock('./StorageFooter', () => ({
  StorageFooter: () => <div data-testid="storage-footer" />,
}))

jest.mock('./SovereignCertificate', () => ({
  SovereignCertificate: () => <div data-testid="sovereign-certificate" />,
}))

jest.mock('./VaultBreadcrumb', () => ({
  VaultBreadcrumb: () => <div data-testid="vault-breadcrumb" />,
}))

jest.mock('./VaultSearchFilters', () => ({
  VaultSearchFilters: () => <div data-testid="vault-search-filters" />,
  filterDocuments: () => [],
}))

jest.mock('./VaultToolbar', () => ({
  VaultToolbar: () => <div data-testid="vault-toolbar" />,
}))

jest.mock('./DocumentPreviewPanel', () => ({
  DocumentPreviewPanel: () => <div data-testid="document-preview-panel" />,
}))

import { VaultPanel } from './VaultPanel'

// ── Tests ───────────────────────────────────────────────────────

describe('VaultPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsCollapsed = false
    // Reset the hasFetched ref by re-importing (jest module isolation handles this)
  })

  test('calls fetchDocuments and fetchFolders on mount', async () => {
    render(<VaultPanel />)
    expect(mockFetchDocuments).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(mockFetchFolders).toHaveBeenCalledTimes(1)
    })
  })

  test('fetchFolders is called only after fetchDocuments resolves', async () => {
    const callOrder: string[] = []

    mockFetchDocuments.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          callOrder.push('fetchDocuments:start')
          setTimeout(() => {
            callOrder.push('fetchDocuments:end')
            resolve()
          }, 10)
        }),
    )

    mockFetchFolders.mockImplementation(() => {
      callOrder.push('fetchFolders:start')
      return Promise.resolve()
    })

    render(<VaultPanel />)

    // Wait for all promises to settle
    await new Promise((r) => setTimeout(r, 50))

    expect(callOrder).toEqual([
      'fetchDocuments:start',
      'fetchDocuments:end',
      'fetchFolders:start',
    ])
  })

  test('renders VaultRail when collapsed', () => {
    mockIsCollapsed = true
    render(<VaultPanel />)
    expect(screen.getByTestId('vault-rail')).toBeInTheDocument()
  })
})
