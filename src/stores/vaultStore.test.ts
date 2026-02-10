/**
 * Store-level tests for vaultStore.
 *
 * These tests verify payload shape and state transitions via mocked fetch.
 * They do NOT exercise actual API route processing. For backend route coverage,
 * see src/app/api/documents/[id]/privilege/route.test.ts.
 */
import { useVaultStore } from './vaultStore'

// ── Helpers ──────────────────────────────────────────────────

function okJson(data: object) {
  return { ok: true, json: async () => data }
}

function errorJson(status: number, data: object) {
  return { ok: false, status, json: async () => data }
}

// ── Setup / Teardown ─────────────────────────────────────────

const originalFetch = global.fetch
const originalConfirm = global.window?.confirm

beforeEach(() => {
  // Reset store state — clear persisted state too
  useVaultStore.setState({
    documents: {},
    folders: {},
    isCollapsed: true,
    currentPath: [],
    selectedItemId: null,
    isLoading: false,
    error: null,
    storage: { used: 0, total: 1073741824 },
  })
  global.fetch = jest.fn()

  // Ensure window.confirm is available in node environment
  if (typeof window === 'undefined') {
    (global as Record<string, unknown>).window = { confirm: jest.fn() }
  } else {
    window.confirm = jest.fn()
  }
})

afterAll(() => {
  global.fetch = originalFetch
  if (originalConfirm) window.confirm = originalConfirm
})

// ── Tests ────────────────────────────────────────────────────

describe('vaultStore', () => {
  describe('uploadDocument – extract and refresh flow', () => {
    test('calls extract then refreshes document list', async () => {
      const extractResponse = okJson({
        data: { documentId: 'doc-1', storagePath: 'docs/file.pdf', gcsUri: 'gs://bucket/docs/file.pdf', mimeType: 'application/pdf' },
      })
      const listResponse = okJson({ documents: [] })

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce(extractResponse)  // extract (creates DB record)
        .mockResolvedValueOnce(listResponse)     // fetchDocuments refresh

      const file = new File(['content'], 'file.pdf', { type: 'application/pdf' })
      await useVaultStore.getState().uploadDocument(file)

      const calls = (global.fetch as jest.Mock).mock.calls

      // First call: extract
      expect(calls[0][0]).toBe('/api/documents/extract')
      expect(calls[0][1].method).toBe('POST')

      // Second call: fetchDocuments refresh
      expect(calls[1][0]).toBe('/api/documents')
    })

    test('passes folderId in FormData when provided', async () => {
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce(okJson({ data: { documentId: 'doc-2', storagePath: 'p', gcsUri: 'gs://b/p', mimeType: 'text/plain' } }))
        .mockResolvedValueOnce(okJson({ documents: [] }))

      const file = new File(['x'], 'test.txt', { type: 'text/plain' })
      await useVaultStore.getState().uploadDocument(file, 'folder-abc')

      const extractBody = (global.fetch as jest.Mock).mock.calls[0][1].body as FormData
      expect(extractBody.get('folderId')).toBe('folder-abc')
    })

    test('does not include folderId when not provided', async () => {
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce(okJson({ data: { documentId: 'doc-3', storagePath: 'p', gcsUri: 'gs://b/p', mimeType: 'text/plain' } }))
        .mockResolvedValueOnce(okJson({ documents: [] }))

      const file = new File(['x'], 'test.txt', { type: 'text/plain' })
      await useVaultStore.getState().uploadDocument(file)

      const extractBody = (global.fetch as jest.Mock).mock.calls[0][1].body as FormData
      expect(extractBody.get('folderId')).toBeNull()
    })

    test('throws if extract step fails', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false })

      const file = new File(['x'], 'test.txt', { type: 'text/plain' })
      await expect(useVaultStore.getState().uploadDocument(file)).rejects.toThrow('Upload failed')
    })
  })

  describe('fetchFolders – response mapping', () => {
    test('flattens object children to IDs', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        okJson({
          folders: [
            {
              id: 'f1',
              name: 'Root',
              parentId: null,
              children: [
                { id: 'f2', name: 'Sub', parentId: 'f1', documentCount: 3 },
              ],
            },
          ],
        }),
      )

      await useVaultStore.getState().fetchFolders()

      const { folders } = useVaultStore.getState()
      expect(folders['f1'].children).toEqual(['f2'])
    })

    test('registers nested children as navigable folder entries', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        okJson({
          folders: [
            {
              id: 'f1',
              name: 'Root',
              parentId: null,
              children: [
                { id: 'f2', name: 'Child', parentId: 'f1' },
              ],
            },
          ],
        }),
      )

      await useVaultStore.getState().fetchFolders()

      const { folders } = useVaultStore.getState()
      expect(folders['f2']).toEqual({
        id: 'f2',
        name: 'Child',
        parentId: 'f1',
        children: [],
        documents: [],
      })
    })

    test('handles string children (already IDs)', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        okJson({
          folders: [
            { id: 'f1', name: 'Root', parentId: null, children: ['f2', 'f3'] },
          ],
        }),
      )

      await useVaultStore.getState().fetchFolders()

      const { folders } = useVaultStore.getState()
      expect(folders['f1'].children).toEqual(['f2', 'f3'])
    })

    test('derives documents from store state', async () => {
      // Pre-populate documents in the store
      useVaultStore.setState({
        documents: {
          'd1': { id: 'd1', name: 'a.pdf', folderId: 'f1' } as never,
          'd2': { id: 'd2', name: 'b.pdf', folderId: 'f1' } as never,
          'd3': { id: 'd3', name: 'c.pdf', folderId: 'f-other' } as never,
        },
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        okJson({
          folders: [{ id: 'f1', name: 'Root', parentId: null, children: [] }],
        }),
      )

      await useVaultStore.getState().fetchFolders()

      const { folders } = useVaultStore.getState()
      expect(folders['f1'].documents.sort()).toEqual(['d1', 'd2'])
    })
  })

  describe('togglePrivilege – confirmation flow', () => {
    const privilegedDoc = {
      id: 'doc-1',
      name: 'secret.pdf',
      isPrivileged: true,
      type: 'document' as const,
      originalName: 'secret.pdf',
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    beforeEach(() => {
      useVaultStore.setState({
        documents: { 'doc-1': privilegedDoc as never },
      })
    })

    test('marks document as privileged on success', async () => {
      useVaultStore.setState({
        documents: {
          'doc-1': { ...privilegedDoc, isPrivileged: false } as never,
        },
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce(okJson({ isPrivileged: true }))

      await useVaultStore.getState().togglePrivilege('doc-1')

      expect(useVaultStore.getState().documents['doc-1'].isPrivileged).toBe(true)
    })

    test('throws on PRIVILEGE_MODE_SAFETY error', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        errorJson(403, {
          code: 'PRIVILEGE_MODE_SAFETY',
          message: 'Exit Privileged Mode first.',
        }),
      )

      await expect(useVaultStore.getState().togglePrivilege('doc-1')).rejects.toThrow(
        'Exit Privileged Mode first.',
      )
    })

    test('prompts confirmation on CONFIRM_UNMARK_REQUIRED and retries', async () => {
      ;(window.confirm as jest.Mock).mockReturnValueOnce(true)

      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce(
          errorJson(400, {
            code: 'CONFIRM_UNMARK_REQUIRED',
            message: 'Are you sure?',
          }),
        )
        .mockResolvedValueOnce(okJson({ isPrivileged: false }))

      await useVaultStore.getState().togglePrivilege('doc-1')

      // Confirm was called
      expect(window.confirm).toHaveBeenCalledWith('Are you sure?')

      // Retry included confirmUnmark: true
      const retryBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)
      expect(retryBody.confirmUnmark).toBe(true)
      expect(retryBody.privileged).toBe(false)

      // State updated
      expect(useVaultStore.getState().documents['doc-1'].isPrivileged).toBe(false)
    })

    test('does not update state when user cancels confirmation', async () => {
      ;(window.confirm as jest.Mock).mockReturnValueOnce(false)

      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        errorJson(400, { code: 'CONFIRM_UNMARK_REQUIRED', message: 'Confirm?' }),
      )

      await useVaultStore.getState().togglePrivilege('doc-1')

      // State unchanged — still privileged
      expect(useVaultStore.getState().documents['doc-1'].isPrivileged).toBe(true)
      // No retry call made
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    test('throws on unknown error codes', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        errorJson(500, { message: 'Server error' }),
      )

      await expect(useVaultStore.getState().togglePrivilege('doc-1')).rejects.toThrow('Server error')
    })

    test('no-ops when document not in store', async () => {
      await useVaultStore.getState().togglePrivilege('nonexistent')
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })
})
