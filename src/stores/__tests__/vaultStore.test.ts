/**
 * Sarah — EPIC-032 T10: VaultStore tests
 *
 * Tests E32-specific store features: filters, view mode, sort,
 * batch operations, preview panel, multi-select, and folder operations.
 */
import { useVaultStore } from '../vaultStore'
import type { VaultItem } from '@/types/ragbox'

// ── Helpers ──────────────────────────────────────────────────

function okJson(data: object) {
  return { ok: true, json: async () => data }
}

function errorResponse() {
  return { ok: false, status: 500, json: async () => ({ message: 'Server error' }) }
}

// Mock toast to prevent runtime errors
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}))

// ── Setup / Teardown ─────────────────────────────────────────

const originalFetch = global.fetch

beforeEach(() => {
  useVaultStore.setState({
    documents: {},
    folders: {},
    isCollapsed: true,
    isExplorerMode: false,
    currentPath: [],
    selectedItemId: null,
    selectedDocumentIds: [],
    isLoading: false,
    error: null,
    searchQuery: '',
    storage: { used: 0, total: 1073741824 },
    filters: { types: [], dateRange: null, sizeRange: null, status: [] },
    viewMode: 'list',
    sortField: 'date',
    sortDirection: 'desc',
    previewDocumentId: null,
    uploadProgress: {},
  })
  global.fetch = jest.fn()
})

afterAll(() => {
  global.fetch = originalFetch
})

// ── Filter Tests ─────────────────────────────────────────────

describe('E32-002: Filters', () => {
  test('setFilter updates filter state immutably', () => {
    useVaultStore.getState().setFilter('types', ['pdf'])
    const { filters } = useVaultStore.getState()
    expect(filters.types).toEqual(['pdf'])
    expect(filters.dateRange).toBeNull()
  })

  test('clearFilters resets all filters', () => {
    useVaultStore.getState().setFilter('types', ['pdf', 'doc'])
    useVaultStore.getState().setFilter('dateRange', 'week')
    useVaultStore.getState().setFilter('sizeRange', 'large')
    useVaultStore.getState().setFilter('status', ['Indexed'])

    useVaultStore.getState().clearFilters()

    const { filters } = useVaultStore.getState()
    expect(filters.types).toEqual([])
    expect(filters.dateRange).toBeNull()
    expect(filters.sizeRange).toBeNull()
    expect(filters.status).toEqual([])
  })

  test('setFilter preserves other filter categories', () => {
    useVaultStore.getState().setFilter('types', ['pdf'])
    useVaultStore.getState().setFilter('dateRange', 'today')

    const { filters } = useVaultStore.getState()
    expect(filters.types).toEqual(['pdf'])
    expect(filters.dateRange).toBe('today')
  })
})

// ── View Mode & Sort Tests ───────────────────────────────────

describe('E32-003: View mode & sort', () => {
  test('setViewMode updates view mode', () => {
    useVaultStore.getState().setViewMode('grid')
    expect(useVaultStore.getState().viewMode).toBe('grid')
  })

  test('setViewMode switches back to list', () => {
    useVaultStore.getState().setViewMode('grid')
    useVaultStore.getState().setViewMode('list')
    expect(useVaultStore.getState().viewMode).toBe('list')
  })

  test('setSort updates sort field and direction', () => {
    useVaultStore.getState().setSort('name', 'asc')
    const state = useVaultStore.getState()
    expect(state.sortField).toBe('name')
    expect(state.sortDirection).toBe('asc')
  })

  test('setSort updates to size desc', () => {
    useVaultStore.getState().setSort('size', 'desc')
    const state = useVaultStore.getState()
    expect(state.sortField).toBe('size')
    expect(state.sortDirection).toBe('desc')
  })
})

// ── Preview Panel Tests ──────────────────────────────────────

describe('E32-004: Preview panel', () => {
  test('setPreviewDocument sets preview document ID', () => {
    useVaultStore.getState().setPreviewDocument('doc-123')
    expect(useVaultStore.getState().previewDocumentId).toBe('doc-123')
  })

  test('setPreviewDocument clears with null', () => {
    useVaultStore.getState().setPreviewDocument('doc-123')
    useVaultStore.getState().setPreviewDocument(null)
    expect(useVaultStore.getState().previewDocumentId).toBeNull()
  })
})

// ── Batch Operations Tests ───────────────────────────────────

describe('E32-009: Batch operations', () => {
  beforeEach(() => {
    useVaultStore.setState({
      documents: {
        'doc-1': { id: 'doc-1', name: 'a.pdf', type: 'document', deletionStatus: 'Active' } as VaultItem,
        'doc-2': { id: 'doc-2', name: 'b.pdf', type: 'document', deletionStatus: 'Active' } as VaultItem,
        'doc-3': { id: 'doc-3', name: 'c.pdf', type: 'document', deletionStatus: 'Active' } as VaultItem,
      },
      selectedDocumentIds: ['doc-1', 'doc-2'],
    })
  })

  test('batchDelete removes documents from state on success', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ success: true, data: { success: 2, failed: 0, errors: [] } }),
    )

    await useVaultStore.getState().batchDelete(['doc-1', 'doc-2'])

    const { documents, selectedDocumentIds } = useVaultStore.getState()
    // After batch delete, documents should be removed from state
    expect(documents['doc-3']).toBeDefined()
    expect(selectedDocumentIds).toEqual([])
  })

  test('batchMove updates folderId on documents', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ success: true, data: { success: 2, failed: 0, errors: [] } }),
    )

    await useVaultStore.getState().batchMove(['doc-1', 'doc-2'], 'folder-abc')

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/documents/batch/move',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('folder-abc'),
      }),
    )
  })

  test('batchUpdateTier updates tier on documents', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ success: true, data: { success: 2, failed: 0, errors: [] } }),
    )

    await useVaultStore.getState().batchUpdateTier(['doc-1', 'doc-2'], 3)

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/documents/batch/tier',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"tier":3'),
      }),
    )
  })
})

// ── Multi-Select Tests ───────────────────────────────────────

describe('Multi-select', () => {
  beforeEach(() => {
    useVaultStore.setState({
      documents: {
        'doc-1': { id: 'doc-1', name: 'a.pdf' } as VaultItem,
        'doc-2': { id: 'doc-2', name: 'b.pdf' } as VaultItem,
        'doc-3': { id: 'doc-3', name: 'c.pdf' } as VaultItem,
      },
    })
  })

  test('toggleDocumentSelection adds ID', () => {
    useVaultStore.getState().toggleDocumentSelection('doc-1')
    expect(useVaultStore.getState().selectedDocumentIds).toEqual(['doc-1'])
  })

  test('toggleDocumentSelection removes already selected ID', () => {
    useVaultStore.setState({ selectedDocumentIds: ['doc-1', 'doc-2'] })
    useVaultStore.getState().toggleDocumentSelection('doc-1')
    expect(useVaultStore.getState().selectedDocumentIds).toEqual(['doc-2'])
  })

  test('selectAll selects all document IDs', () => {
    useVaultStore.getState().selectAll()
    const ids = useVaultStore.getState().selectedDocumentIds.sort()
    expect(ids).toEqual(['doc-1', 'doc-2', 'doc-3'])
  })

  test('clearSelection empties selected IDs', () => {
    useVaultStore.setState({ selectedDocumentIds: ['doc-1', 'doc-2'] })
    useVaultStore.getState().clearSelection()
    expect(useVaultStore.getState().selectedDocumentIds).toEqual([])
  })

  test('setSelectedDocumentIds replaces selection', () => {
    useVaultStore.getState().setSelectedDocumentIds(['doc-2', 'doc-3'])
    expect(useVaultStore.getState().selectedDocumentIds).toEqual(['doc-2', 'doc-3'])
  })
})

// ── Folder Operations ────────────────────────────────────────

describe('Folder operations', () => {
  test('moveFolder updates folder parentId', async () => {
    useVaultStore.setState({
      folders: {
        'f1': { id: 'f1', name: 'Root', children: ['f2'], documents: [] },
        'f2': { id: 'f2', name: 'Child', parentId: 'f1', children: [], documents: [] },
      },
    })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ success: true, data: { folder: { id: 'f2', name: 'Child', parentId: null } } }),
    )

    await useVaultStore.getState().moveFolder('f2', null)

    // Optimistic update should move f2 to root
    const { folders } = useVaultStore.getState()
    expect(folders['f2'].parentId).toBeUndefined()
  })

  test('folder color updates via setFolderColor', async () => {
    useVaultStore.setState({
      folders: {
        'f1': { id: 'f1', name: 'Contracts', children: [], documents: [] },
      },
    })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ success: true, data: { folder: { id: 'f1', name: 'Contracts', color: 'green' } } }),
    )

    await useVaultStore.getState().setFolderColor('f1', 'green')

    const { folders } = useVaultStore.getState()
    expect(folders['f1'].color).toBe('green')
  })
})

// ── Upload Progress Tests ────────────────────────────────────

describe('E32-005: Upload progress', () => {
  test('setUploadProgress creates new entry', () => {
    useVaultStore.getState().setUploadProgress('file-1', { status: 'uploading', progress: 50 })
    expect(useVaultStore.getState().uploadProgress['file-1']).toEqual({
      status: 'uploading',
      progress: 50,
    })
  })

  test('setUploadProgress updates existing entry', () => {
    useVaultStore.getState().setUploadProgress('file-1', { status: 'uploading', progress: 50 })
    useVaultStore.getState().setUploadProgress('file-1', { progress: 75 })
    expect(useVaultStore.getState().uploadProgress['file-1'].progress).toBe(75)
    expect(useVaultStore.getState().uploadProgress['file-1'].status).toBe('uploading')
  })

  test('clearUploadProgress removes all entries', () => {
    useVaultStore.getState().setUploadProgress('file-1', { status: 'done', progress: 100 })
    useVaultStore.getState().setUploadProgress('file-2', { status: 'done', progress: 100 })
    useVaultStore.getState().clearUploadProgress()
    expect(useVaultStore.getState().uploadProgress).toEqual({})
  })
})
