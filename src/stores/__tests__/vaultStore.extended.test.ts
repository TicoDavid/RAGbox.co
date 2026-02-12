/**
 * Extended store-level tests for vaultStore.
 *
 * Covers fetchDocuments, deleteDocument, updateDocument,
 * and additional edge cases not covered by the base vaultStore.test.ts.
 */
import { useVaultStore } from '../vaultStore'

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
    currentPath: [],
    selectedItemId: null,
    isLoading: false,
    error: null,
    searchQuery: '',
    storage: { used: 0, total: 1073741824 },
  })
  global.fetch = jest.fn()
})

afterAll(() => {
  global.fetch = originalFetch
})

// ── Tests ────────────────────────────────────────────────────

describe('vaultStore – fetchDocuments', () => {
  test('populates store with documents from API response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({
        documents: [
          {
            id: 'doc-1',
            filename: 'contract.pdf',
            originalName: 'contract.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 2048,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-02T00:00:00Z',
            indexStatus: 'Indexed',
            isPrivileged: false,
            securityTier: 1,
            deletionStatus: 'Active',
          },
          {
            id: 'doc-2',
            filename: 'memo.docx',
            originalName: 'memo.docx',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            sizeBytes: 4096,
            createdAt: '2025-01-03T00:00:00Z',
            updatedAt: '2025-01-04T00:00:00Z',
            indexStatus: 'Processing',
            isPrivileged: true,
            securityTier: 3,
            deletionStatus: 'Active',
          },
        ],
      }),
    )

    await useVaultStore.getState().fetchDocuments()

    const { documents, isLoading, error } = useVaultStore.getState()
    expect(Object.keys(documents)).toHaveLength(2)
    expect(documents['doc-1'].name).toBe('contract.pdf')
    expect(documents['doc-1'].size).toBe(2048)
    expect(documents['doc-1'].isPrivileged).toBe(false)
    expect(documents['doc-2'].name).toBe('memo.docx')
    expect(documents['doc-2'].isPrivileged).toBe(true)
    expect(documents['doc-2'].securityTier).toBe(3)
    expect(isLoading).toBe(false)
    expect(error).toBeNull()
  })

  test('handles nested data.documents response shape', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({
        data: {
          documents: [
            {
              id: 'doc-3',
              filename: 'report.pdf',
              originalName: 'report.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 1024,
              createdAt: '2025-01-01T00:00:00Z',
              updatedAt: '2025-01-01T00:00:00Z',
              isPrivileged: false,
              deletionStatus: 'Active',
            },
          ],
        },
      }),
    )

    await useVaultStore.getState().fetchDocuments()

    expect(useVaultStore.getState().documents['doc-3']).toBeDefined()
    expect(useVaultStore.getState().documents['doc-3'].name).toBe('report.pdf')
  })

  test('handles empty document list', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ documents: [] }),
    )

    await useVaultStore.getState().fetchDocuments()

    expect(Object.keys(useVaultStore.getState().documents)).toHaveLength(0)
    expect(useVaultStore.getState().isLoading).toBe(false)
  })

  test('sets isLoading during fetch', async () => {
    let capturedLoading = false

    ;(global.fetch as jest.Mock).mockImplementationOnce(async () => {
      capturedLoading = useVaultStore.getState().isLoading
      return okJson({ documents: [] })
    })

    await useVaultStore.getState().fetchDocuments()

    expect(capturedLoading).toBe(true)
    expect(useVaultStore.getState().isLoading).toBe(false)
  })

  test('sets error on fetch failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false })

    await useVaultStore.getState().fetchDocuments()

    expect(useVaultStore.getState().error).toBe('Failed to fetch documents')
    expect(useVaultStore.getState().isLoading).toBe(false)
  })

  test('includes search query in URL params', async () => {
    useVaultStore.setState({ searchQuery: 'contract' })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ documents: [] }),
    )

    await useVaultStore.getState().fetchDocuments()

    const url = (global.fetch as jest.Mock).mock.calls[0][0]
    expect(url).toContain('/api/documents?search=contract')
  })

  test('uses doc.name fallback when filename is missing', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({
        documents: [
          {
            id: 'doc-4',
            name: 'fallback-name.pdf',
            originalName: 'fallback-name.pdf',
            mimeType: 'application/pdf',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
            isPrivileged: false,
            deletionStatus: 'Active',
          },
        ],
      }),
    )

    await useVaultStore.getState().fetchDocuments()

    expect(useVaultStore.getState().documents['doc-4'].name).toBe('fallback-name.pdf')
  })
})

describe('vaultStore – deleteDocument', () => {
  beforeEach(() => {
    useVaultStore.setState({
      documents: {
        'doc-1': {
          id: 'doc-1',
          name: 'file.pdf',
          originalName: 'file.pdf',
          type: 'document',
          createdAt: new Date(),
          updatedAt: new Date(),
          isPrivileged: false,
          securityTier: 0,
          deletionStatus: 'Active',
        } as never,
        'doc-2': {
          id: 'doc-2',
          name: 'other.pdf',
          originalName: 'other.pdf',
          type: 'document',
          createdAt: new Date(),
          updatedAt: new Date(),
          isPrivileged: false,
          securityTier: 0,
          deletionStatus: 'Active',
        } as never,
      },
    })
  })

  test('removes document from store optimistically', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

    await useVaultStore.getState().deleteDocument('doc-1')

    const docs = useVaultStore.getState().documents
    expect(docs['doc-1']).toBeUndefined()
    expect(docs['doc-2']).toBeDefined()
  })

  test('sends DELETE request to /api/documents/:id', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

    await useVaultStore.getState().deleteDocument('doc-1')

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/api/documents/doc-1')
    expect(init.method).toBe('DELETE')
  })

  test('re-fetches documents on delete failure to restore state', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false }) // DELETE fails
      .mockResolvedValueOnce(okJson({ documents: [] })) // fetchDocuments refresh

    await expect(
      useVaultStore.getState().deleteDocument('doc-1'),
    ).rejects.toThrow('Delete failed')

    // fetchDocuments was called to restore the state
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})

describe('vaultStore – updateDocument', () => {
  beforeEach(() => {
    useVaultStore.setState({
      documents: {
        'doc-1': {
          id: 'doc-1',
          name: 'old-name.pdf',
          originalName: 'old-name.pdf',
          type: 'document',
          createdAt: new Date(),
          updatedAt: new Date(),
          isPrivileged: false,
          securityTier: 0,
          deletionStatus: 'Active',
        } as never,
      },
    })
  })

  test('sends PATCH request with updates', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ name: 'new-name.pdf' }),
    )

    await useVaultStore.getState().updateDocument('doc-1', { name: 'new-name.pdf' } as never)

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/api/documents/doc-1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ name: 'new-name.pdf' })
  })

  test('merges API response into existing document state', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({ name: 'renamed.pdf', updatedAt: '2025-06-01T00:00:00Z' }),
    )

    await useVaultStore.getState().updateDocument('doc-1', { name: 'renamed.pdf' } as never)

    const doc = useVaultStore.getState().documents['doc-1']
    expect(doc.name).toBe('renamed.pdf')
    // Original fields should still be present
    expect(doc.id).toBe('doc-1')
  })

  test('throws on non-ok response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(errorResponse())

    await expect(
      useVaultStore.getState().updateDocument('doc-1', { name: 'x' } as never),
    ).rejects.toThrow('Update failed')
  })

  test('does not modify store state on failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(errorResponse())

    try {
      await useVaultStore.getState().updateDocument('doc-1', { name: 'x' } as never)
    } catch {
      // expected
    }

    // Original name should be unchanged
    expect(useVaultStore.getState().documents['doc-1'].name).toBe('old-name.pdf')
  })
})

describe('vaultStore – UI state actions', () => {
  test('toggleCollapse flips isCollapsed', () => {
    expect(useVaultStore.getState().isCollapsed).toBe(true)

    useVaultStore.getState().toggleCollapse()
    expect(useVaultStore.getState().isCollapsed).toBe(false)

    useVaultStore.getState().toggleCollapse()
    expect(useVaultStore.getState().isCollapsed).toBe(true)
  })

  test('setCollapsed sets the collapsed state directly', () => {
    useVaultStore.getState().setCollapsed(false)
    expect(useVaultStore.getState().isCollapsed).toBe(false)

    useVaultStore.getState().setCollapsed(true)
    expect(useVaultStore.getState().isCollapsed).toBe(true)
  })

  test('navigate updates currentPath and clears selectedItemId', () => {
    useVaultStore.setState({ selectedItemId: 'doc-1' })

    useVaultStore.getState().navigate(['folder-1', 'folder-2'])

    expect(useVaultStore.getState().currentPath).toEqual(['folder-1', 'folder-2'])
    expect(useVaultStore.getState().selectedItemId).toBeNull()
  })

  test('selectItem updates selectedItemId', () => {
    useVaultStore.getState().selectItem('doc-1')
    expect(useVaultStore.getState().selectedItemId).toBe('doc-1')

    useVaultStore.getState().selectItem(null)
    expect(useVaultStore.getState().selectedItemId).toBeNull()
  })

  test('setSearchQuery updates the search query', () => {
    useVaultStore.getState().setSearchQuery('contract')
    expect(useVaultStore.getState().searchQuery).toBe('contract')
  })
})
