/**
 * Extended store-level tests for vaultStore.
 *
 * Covers fetchDocuments, deleteDocument, updateDocument,
 * explorer/multi-select UI, toggleStar, togglePrivilege,
 * folder CRUD (create/rename/delete), moveDocument, fetchFolders,
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
    isExplorerMode: false,
    currentPath: [],
    selectedItemId: null,
    selectedDocumentIds: [],
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

  test('toggleExplorerMode flips isExplorerMode and expands vault', () => {
    useVaultStore.setState({ isExplorerMode: false, isCollapsed: true })

    useVaultStore.getState().toggleExplorerMode()

    expect(useVaultStore.getState().isExplorerMode).toBe(true)
    expect(useVaultStore.getState().isCollapsed).toBe(false) // always expand
  })

  test('toggleExplorerMode toggles back off', () => {
    useVaultStore.setState({ isExplorerMode: true, isCollapsed: false })

    useVaultStore.getState().toggleExplorerMode()

    expect(useVaultStore.getState().isExplorerMode).toBe(false)
    expect(useVaultStore.getState().isCollapsed).toBe(false) // stays expanded
  })

  test('exitExplorerMode sets isExplorerMode to false', () => {
    useVaultStore.setState({ isExplorerMode: true })

    useVaultStore.getState().exitExplorerMode()

    expect(useVaultStore.getState().isExplorerMode).toBe(false)
  })

  test('selectAndChat sets selection and exits explorer mode', () => {
    useVaultStore.setState({ isExplorerMode: true, isCollapsed: true, selectedItemId: null })

    useVaultStore.getState().selectAndChat('doc-42')

    expect(useVaultStore.getState().selectedItemId).toBe('doc-42')
    expect(useVaultStore.getState().isExplorerMode).toBe(false)
    expect(useVaultStore.getState().isCollapsed).toBe(false)
  })
})

// ── Multi-Select ────────────────────────────────────────────

describe('vaultStore – multi-select', () => {
  beforeEach(() => {
    useVaultStore.setState({
      documents: {
        'doc-a': { id: 'doc-a', name: 'a.pdf' } as never,
        'doc-b': { id: 'doc-b', name: 'b.pdf' } as never,
        'doc-c': { id: 'doc-c', name: 'c.pdf' } as never,
      },
      selectedDocumentIds: [],
    })
  })

  test('setSelectedDocumentIds replaces the selection', () => {
    useVaultStore.getState().setSelectedDocumentIds(['doc-a', 'doc-b'])

    expect(useVaultStore.getState().selectedDocumentIds).toEqual(['doc-a', 'doc-b'])
  })

  test('toggleDocumentSelection adds an unselected id', () => {
    useVaultStore.getState().toggleDocumentSelection('doc-a')

    expect(useVaultStore.getState().selectedDocumentIds).toEqual(['doc-a'])
  })

  test('toggleDocumentSelection removes an already-selected id', () => {
    useVaultStore.setState({ selectedDocumentIds: ['doc-a', 'doc-b'] })

    useVaultStore.getState().toggleDocumentSelection('doc-a')

    expect(useVaultStore.getState().selectedDocumentIds).toEqual(['doc-b'])
  })

  test('clearSelection empties selectedDocumentIds', () => {
    useVaultStore.setState({ selectedDocumentIds: ['doc-a', 'doc-b'] })

    useVaultStore.getState().clearSelection()

    expect(useVaultStore.getState().selectedDocumentIds).toEqual([])
  })

  test('selectAll selects every document key', () => {
    useVaultStore.getState().selectAll()

    const ids = useVaultStore.getState().selectedDocumentIds.sort()
    expect(ids).toEqual(['doc-a', 'doc-b', 'doc-c'])
  })
})

// ── toggleStar ──────────────────────────────────────────────

describe('vaultStore – toggleStar', () => {
  beforeEach(() => {
    useVaultStore.setState({
      documents: {
        'doc-1': {
          id: 'doc-1',
          name: 'brief.pdf',
          originalName: 'brief.pdf',
          type: 'document',
          createdAt: new Date(),
          updatedAt: new Date(),
          isPrivileged: false,
          isStarred: false,
          securityTier: 0,
          deletionStatus: 'Active',
        } as never,
      },
    })
  })

  test('stars an unstarred document on success', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

    await useVaultStore.getState().toggleStar('doc-1')

    expect(useVaultStore.getState().documents['doc-1'].isStarred).toBe(true)
  })

  test('sends POST to /api/documents/:id/star', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

    await useVaultStore.getState().toggleStar('doc-1')

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/api/documents/doc-1/star')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ starred: true })
  })

  test('unstars a starred document on success', async () => {
    useVaultStore.setState({
      documents: {
        'doc-1': { ...useVaultStore.getState().documents['doc-1'], isStarred: true } as never,
      },
    })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

    await useVaultStore.getState().toggleStar('doc-1')

    expect(useVaultStore.getState().documents['doc-1'].isStarred).toBe(false)
  })

  test('throws and does not update state on failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false })

    await expect(useVaultStore.getState().toggleStar('doc-1')).rejects.toThrow('Star toggle failed')

    expect(useVaultStore.getState().documents['doc-1'].isStarred).toBe(false)
  })

  test('no-ops when document id does not exist', async () => {
    await useVaultStore.getState().toggleStar('non-existent')

    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ── togglePrivilege ─────────────────────────────────────────

describe('vaultStore – togglePrivilege', () => {
  beforeEach(() => {
    useVaultStore.setState({
      documents: {
        'doc-1': {
          id: 'doc-1',
          name: 'contract.pdf',
          originalName: 'contract.pdf',
          type: 'document',
          createdAt: new Date(),
          updatedAt: new Date(),
          isPrivileged: false,
          isStarred: false,
          securityTier: 0,
          deletionStatus: 'Active',
        } as never,
      },
    })
  })

  test('marks document as privileged on success', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

    await useVaultStore.getState().togglePrivilege('doc-1')

    expect(useVaultStore.getState().documents['doc-1'].isPrivileged).toBe(true)
  })

  test('sends PATCH to /api/documents/:id/privilege', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true })

    await useVaultStore.getState().togglePrivilege('doc-1')

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/api/documents/doc-1/privilege')
    expect(init.method).toBe('PATCH')
    const body = JSON.parse(init.body)
    expect(body.privileged).toBe(true)
    expect(body.filename).toBe('contract.pdf')
  })

  test('throws on PRIVILEGE_MODE_SAFETY error', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        code: 'PRIVILEGE_MODE_SAFETY',
        message: 'Cannot remove privilege in Privileged Mode',
      }),
    })

    await expect(useVaultStore.getState().togglePrivilege('doc-1')).rejects.toThrow(
      'Cannot remove privilege in Privileged Mode',
    )

    // State should not have changed
    expect(useVaultStore.getState().documents['doc-1'].isPrivileged).toBe(false)
  })

  test('no-ops when document id does not exist', async () => {
    await useVaultStore.getState().togglePrivilege('missing-doc')

    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ── Folder Actions ──────────────────────────────────────────

describe('vaultStore – createFolder', () => {
  test('sends POST to /api/documents/folders and refreshes folders', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true }) // createFolder POST
      .mockResolvedValueOnce(okJson({ folders: [] })) // fetchFolders refresh

    await useVaultStore.getState().createFolder('Legal', 'parent-1')

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/api/documents/folders')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ name: 'Legal', parentId: 'parent-1' })
  })

  test('throws on failure and does not refresh folders', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false })

    await expect(useVaultStore.getState().createFolder('Bad')).rejects.toThrow('Folder creation failed')

    // Only the one failed call, no fetchFolders
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })
})

describe('vaultStore – renameFolder', () => {
  test('sends PATCH with new name and refreshes folders', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true }) // renameFolder PATCH
      .mockResolvedValueOnce(okJson({ folders: [] })) // fetchFolders refresh

    await useVaultStore.getState().renameFolder('folder-1', 'Renamed')

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/api/documents/folders/folder-1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ name: 'Renamed' })
  })

  test('throws on failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false })

    await expect(useVaultStore.getState().renameFolder('folder-1', 'X')).rejects.toThrow('Folder rename failed')
  })
})

describe('vaultStore – deleteFolder', () => {
  test('sends DELETE and refreshes both folders and documents', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true }) // deleteFolder DELETE
      .mockResolvedValueOnce(okJson({ folders: [] })) // fetchFolders
      .mockResolvedValueOnce(okJson({ documents: [] })) // fetchDocuments

    await useVaultStore.getState().deleteFolder('folder-1')

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/api/documents/folders/folder-1')
    expect(init.method).toBe('DELETE')
    // Both refreshes called
    expect(global.fetch).toHaveBeenCalledTimes(3)
  })

  test('throws on failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false })

    await expect(useVaultStore.getState().deleteFolder('folder-1')).rejects.toThrow('Folder deletion failed')
  })
})

// ── moveDocument ────────────────────────────────────────────

describe('vaultStore – moveDocument', () => {
  beforeEach(() => {
    useVaultStore.setState({
      documents: {
        'doc-1': {
          id: 'doc-1',
          name: 'brief.pdf',
          originalName: 'brief.pdf',
          type: 'document',
          folderId: undefined,
          createdAt: new Date(),
          updatedAt: new Date(),
          isPrivileged: false,
          isStarred: false,
          securityTier: 0,
          deletionStatus: 'Active',
        } as never,
      },
      folders: {
        'folder-1': {
          id: 'folder-1',
          name: 'Legal',
          children: [],
          documents: [],
        },
      },
    })
  })

  test('optimistically updates folderId and sends POST', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true }) // moveDocument POST
      .mockResolvedValueOnce(okJson({ folders: [] })) // fetchFolders refresh

    await useVaultStore.getState().moveDocument('doc-1', 'folder-1')

    expect(useVaultStore.getState().documents['doc-1'].folderId).toBe('folder-1')

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toContain('/api/documents/doc-1/move')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ folderId: 'folder-1' })
  })

  test('moves document to root (null folderId)', async () => {
    useVaultStore.setState({
      documents: {
        'doc-1': { ...useVaultStore.getState().documents['doc-1'], folderId: 'folder-1' } as never,
      },
    })
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce(okJson({ folders: [] }))

    await useVaultStore.getState().moveDocument('doc-1', null)

    // folderId should be undefined (null coerced via ?? undefined)
    expect(useVaultStore.getState().documents['doc-1'].folderId).toBeUndefined()
  })

  test('reverts optimistic update on failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false })

    await expect(useVaultStore.getState().moveDocument('doc-1', 'folder-1')).rejects.toThrow('Move failed')

    // Should revert to original (no folderId)
    expect(useVaultStore.getState().documents['doc-1'].folderId).toBeUndefined()
  })

  test('no-ops when document id does not exist', async () => {
    await useVaultStore.getState().moveDocument('non-existent', 'folder-1')

    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ── fetchFolders ────────────────────────────────────────────

describe('vaultStore – fetchFolders', () => {
  test('populates folders from API response', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({
        folders: [
          { id: 'f-1', name: 'Legal', parentId: null, children: [] },
          { id: 'f-2', name: 'Finance', parentId: null, children: [] },
        ],
      }),
    )

    await useVaultStore.getState().fetchFolders()

    const { folders } = useVaultStore.getState()
    expect(Object.keys(folders)).toHaveLength(2)
    expect(folders['f-1'].name).toBe('Legal')
    expect(folders['f-2'].name).toBe('Finance')
  })

  test('handles nested child objects and registers them', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({
        folders: [
          {
            id: 'f-parent',
            name: 'Root Folder',
            parentId: null,
            children: [
              { id: 'f-child', name: 'Sub Folder', parentId: 'f-parent' },
            ],
          },
        ],
      }),
    )

    await useVaultStore.getState().fetchFolders()

    const { folders } = useVaultStore.getState()
    expect(folders['f-parent'].children).toEqual(['f-child'])
    // Child should also be registered as a folder entry
    expect(folders['f-child']).toBeDefined()
    expect(folders['f-child'].name).toBe('Sub Folder')
    expect(folders['f-child'].parentId).toBe('f-parent')
  })

  test('handles string children ids', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({
        folders: [
          { id: 'f-1', name: 'Parent', parentId: null, children: ['f-2', 'f-3'] },
        ],
      }),
    )

    await useVaultStore.getState().fetchFolders()

    expect(useVaultStore.getState().folders['f-1'].children).toEqual(['f-2', 'f-3'])
  })

  test('cross-references documents into folder.documents', async () => {
    // Pre-populate a document that belongs to folder f-1
    useVaultStore.setState({
      documents: {
        'doc-in-folder': {
          id: 'doc-in-folder',
          name: 'inside.pdf',
          folderId: 'f-1',
        } as never,
      },
    })

    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({
        folders: [
          { id: 'f-1', name: 'Legal', parentId: null, children: [] },
        ],
      }),
    )

    await useVaultStore.getState().fetchFolders()

    expect(useVaultStore.getState().folders['f-1'].documents).toEqual(['doc-in-folder'])
  })

  test('silently handles fetch failure without setting error', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    await useVaultStore.getState().fetchFolders()

    // No error should be set (silently ignored per implementation)
    expect(useVaultStore.getState().error).toBeNull()
    expect(Object.keys(useVaultStore.getState().folders)).toHaveLength(0)
  })

  test('handles data-wrapped response shape', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(
      okJson({
        data: [
          { id: 'f-1', name: 'Wrapped', parentId: null, children: [] },
        ],
      }),
    )

    await useVaultStore.getState().fetchFolders()

    expect(useVaultStore.getState().folders['f-1'].name).toBe('Wrapped')
  })
})
