import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { VaultItem, FolderNode } from '@/types/ragbox'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'

interface VaultState {
  // Data
  documents: Record<string, VaultItem>
  folders: Record<string, FolderNode>

  // UI State
  isCollapsed: boolean
  isExplorerMode: boolean // Full-screen explorer mode (80% width)
  currentPath: string[]
  selectedItemId: string | null
  isLoading: boolean
  error: string | null
  searchQuery: string

  // Storage
  storage: { used: number; total: number }

  // Actions
  toggleCollapse: () => void
  setCollapsed: (collapsed: boolean) => void
  toggleExplorerMode: () => void
  exitExplorerMode: () => void
  selectAndChat: (id: string) => void // Select file and switch to chat mode
  navigate: (path: string[]) => void
  selectItem: (id: string | null) => void
  setSearchQuery: (query: string) => void

  // API Actions
  fetchDocuments: () => Promise<void>
  fetchFolders: () => Promise<void>
  uploadDocument: (file: File, folderId?: string) => Promise<void>
  uploadDocuments: (files: File[], folderId?: string) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  updateDocument: (id: string, updates: Partial<VaultItem>) => Promise<void>
  togglePrivilege: (id: string) => Promise<void>
  toggleStar: (id: string) => Promise<void>

  // Multi-Select
  selectedDocumentIds: string[]
  setSelectedDocumentIds: (ids: string[]) => void
  toggleDocumentSelection: (id: string) => void
  clearSelection: () => void
  selectAll: () => void

  // Folder Actions
  createFolder: (name: string, parentId?: string) => Promise<void>
  renameFolder: (id: string, name: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
  moveDocument: (docId: string, folderId: string | null) => Promise<void>
}

export const useVaultStore = create<VaultState>()(
  devtools(
    persist(
      (set, get) => ({
        documents: {},
        folders: {},
        isCollapsed: true,
        isExplorerMode: false,
        currentPath: [],
        selectedItemId: null,
        isLoading: false,
        error: null,
        searchQuery: '',
        storage: { used: 0, total: 1073741824 },
        selectedDocumentIds: [],

        toggleCollapse: () => set((state) => ({ isCollapsed: !state.isCollapsed })),

        setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),

        toggleExplorerMode: () => set((state) => ({
          isExplorerMode: !state.isExplorerMode,
          isCollapsed: false, // Always expand when entering explorer mode
        })),

        exitExplorerMode: () => set({ isExplorerMode: false }),

        selectAndChat: (id) => set({
          selectedItemId: id,
          isExplorerMode: false, // Exit explorer mode
          isCollapsed: false, // Keep vault visible but not in explorer mode
        }),

        navigate: (path) => set({ currentPath: path, selectedItemId: null }),

        selectItem: (id) => set({ selectedItemId: id }),

        setSearchQuery: (query) => set({ searchQuery: query }),

        setSelectedDocumentIds: (ids) => set({ selectedDocumentIds: ids }),

        toggleDocumentSelection: (id) => set((state) => ({
          selectedDocumentIds: state.selectedDocumentIds.includes(id)
            ? state.selectedDocumentIds.filter(i => i !== id)
            : [...state.selectedDocumentIds, id],
        })),

        clearSelection: () => set({ selectedDocumentIds: [] }),

        selectAll: () => set((state) => ({
          selectedDocumentIds: Object.keys(state.documents),
        })),

        fetchDocuments: async () => {
          set({ isLoading: true, error: null })
          try {
            const search = get().searchQuery
            const params = new URLSearchParams()
            if (search) params.set('search', search)
            const queryString = params.toString()
            const url = queryString ? `/api/documents?${queryString}` : '/api/documents'
            const res = await apiFetch(url)
            if (!res.ok) throw new Error('Failed to fetch documents')
            const json = await res.json()
            const docList = json.data?.documents ?? json.documents ?? []
            const documents: Record<string, VaultItem> = {}
            for (const doc of docList) {
              documents[doc.id] = {
                id: doc.id,
                name: doc.filename ?? doc.name,
                originalName: doc.originalName,
                type: 'document',
                mimeType: doc.mimeType,
                size: doc.sizeBytes ?? doc.size,
                createdAt: new Date(doc.createdAt ?? doc.uploadedAt),
                updatedAt: new Date(doc.updatedAt),
                parentId: doc.folderId,
                folderId: doc.folderId,
                status: doc.indexStatus ?? doc.status,
                isPrivileged: doc.isPrivileged,
                isStarred: doc.isStarred ?? false,
                securityTier: doc.securityTier ?? 0,
                deletionStatus: doc.deletionStatus,
                checksum: doc.checksum,
              }
            }
            set({ documents, isLoading: false })
          } catch (error) {
            set({ error: (error as Error).message, isLoading: false })
          }
        },

        fetchFolders: async () => {
          try {
            const res = await apiFetch('/api/documents/folders')
            if (!res.ok) throw new Error('Failed to fetch folders')
            const json = await res.json()
            const folderList = json.data ?? json.folders ?? []
            const folders: Record<string, FolderNode> = {}
            for (const folder of folderList) {
              // Register nested children as folder entries
              const childIds: string[] = []
              if (Array.isArray(folder.children)) {
                for (const child of folder.children) {
                  if (typeof child === 'string') {
                    childIds.push(child)
                  } else if (child && typeof child === 'object' && child.id) {
                    childIds.push(child.id)
                    // Register child folder if not already present
                    if (!folders[child.id]) {
                      folders[child.id] = {
                        id: child.id,
                        name: child.name ?? '',
                        parentId: child.parentId ?? folder.id,
                        children: [],
                        documents: [],
                      }
                    }
                  }
                }
              }

              // Derive documents from already-fetched documents in the store
              const currentDocuments = get().documents
              const folderDocIds = Object.values(currentDocuments)
                .filter(d => d.folderId === folder.id)
                .map(d => d.id)

              folders[folder.id] = {
                id: folder.id,
                name: folder.name,
                parentId: folder.parentId,
                children: childIds,
                documents: folderDocIds,
              }
            }
            set({ folders })
          } catch {
            // Silently ignore
          }
        },

        uploadDocument: async (file, folderId) => {
          const formData = new FormData()
          formData.append('file', file)
          if (folderId) formData.append('folderId', folderId)

          // Upload to GCS via extract endpoint (also creates DB record)
          const extractRes = await apiFetch('/api/documents/extract', {
            method: 'POST',
            body: formData,
          })

          if (!extractRes.ok) throw new Error('Upload failed')

          // Document record was created by the extract endpoint — refresh list
          await get().fetchDocuments()
        },

        uploadDocuments: async (files, folderId) => {
          const uploaded: Array<{ filename: string; size: number }> = []
          for (const file of files) {
            await get().uploadDocument(file, folderId)
            uploaded.push({ filename: file.name, size: file.size })
          }

          // Notify Mercury once for the entire batch
          if (typeof window !== 'undefined' && uploaded.length > 0) {
            window.dispatchEvent(new CustomEvent('vault:documents-uploaded', {
              detail: { files: uploaded },
            }))
          }

          // Poll for ingestion progress until all docs are ready/error
          const pollIngestion = () => {
            const docs = Object.values(get().documents)
            const pending = docs.some((d) => d.status === 'pending' || d.status === 'processing' || d.status === 'Pending' || d.status === 'Processing')
            if (!pending) return
            setTimeout(async () => {
              await get().fetchDocuments()
              pollIngestion()
            }, 3000)
          }
          pollIngestion()
        },

        deleteDocument: async (id) => {
          set((state) => {
            const { [id]: _deleted, ...rest } = state.documents
            return { documents: rest }
          })

          try {
            const res = await apiFetch(`/api/documents/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Delete failed')
            toast.success('Document deleted')
          } catch (error) {
            toast.error('Failed to delete document')
            get().fetchDocuments()
            throw error
          }
        },

        updateDocument: async (id, updates) => {
          try {
            const res = await apiFetch(`/api/documents/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updates),
            })

            if (!res.ok) throw new Error('Update failed')
            const data = await res.json()
            set((state) => ({
              documents: {
                ...state.documents,
                [id]: { ...state.documents[id], ...data },
              },
            }))
            toast.success('Document renamed')
          } catch (error) {
            toast.error('Failed to update document')
            throw error
          }
        },

        togglePrivilege: async (id) => {
          const doc = get().documents[id]
          if (!doc) return

          const newPrivileged = !doc.isPrivileged

          try {
            const makeRequest = async (confirmUnmark?: boolean) => {
              const body: { privileged: boolean; filename: string; confirmUnmark?: boolean } = {
                privileged: newPrivileged,
                filename: doc.name,
              }
              if (confirmUnmark) body.confirmUnmark = true

              return apiFetch(`/api/documents/${id}/privilege`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              })
            }

            let res = await makeRequest()

            if (!res.ok) {
              const errorData = await res.json().catch(() => null)
              const code = errorData?.code

              if (code === 'PRIVILEGE_MODE_SAFETY') {
                throw new Error(errorData?.message ?? 'Cannot remove privilege protection while in Privileged Mode. Exit Privileged Mode first.')
              }

              if (code === 'CONFIRM_UNMARK_REQUIRED') {
                const confirmed = window.confirm(
                  errorData?.message ?? 'Removing privilege protection will make this document visible in normal mode. Continue?'
                )
                if (!confirmed) return

                res = await makeRequest(true)
                if (!res.ok) throw new Error('Privilege toggle failed')
              } else {
                throw new Error(errorData?.message ?? 'Privilege toggle failed')
              }
            }

            set((state) => ({
              documents: {
                ...state.documents,
                [id]: { ...state.documents[id], isPrivileged: newPrivileged },
              },
            }))
            toast.success('Privilege updated')
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to update privilege')
            throw error
          }
        },

        toggleStar: async (id) => {
          const doc = get().documents[id]
          if (!doc) return

          const newStarred = !doc.isStarred

          try {
            const res = await apiFetch(`/api/documents/${id}/star`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ starred: newStarred }),
            })
            if (!res.ok) throw new Error('Star toggle failed')

            set((state) => ({
              documents: {
                ...state.documents,
                [id]: { ...state.documents[id], isStarred: newStarred },
              },
            }))
          } catch (error) {
            toast.error('Failed to update star')
            throw error
          }
        },

        createFolder: async (name, parentId) => {
          try {
            const res = await apiFetch('/api/documents/folders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, parentId }),
            })

            if (!res.ok) throw new Error('Folder creation failed')
            get().fetchFolders()
            toast.success('Folder created')
          } catch (error) {
            toast.error('Failed to create folder')
            throw error
          }
        },

        renameFolder: async (id, name) => {
          try {
            const res = await apiFetch(`/api/documents/folders/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name }),
            })

            if (!res.ok) throw new Error('Folder rename failed')
            get().fetchFolders()
            toast.success('Folder renamed')
          } catch (error) {
            toast.error('Failed to rename folder')
            throw error
          }
        },

        deleteFolder: async (id) => {
          try {
            const res = await apiFetch(`/api/documents/folders/${id}`, {
              method: 'DELETE',
            })

            if (!res.ok) throw new Error('Folder deletion failed')
            get().fetchFolders()
            get().fetchDocuments()
            toast.success('Folder deleted — files moved to root')
          } catch (error) {
            toast.error('Failed to delete folder')
            throw error
          }
        },

        moveDocument: async (docId, folderId) => {
          const { documents, folders } = get()
          const doc = documents[docId]
          if (!doc) return

          // Optimistic UI: update locally first
          set((state) => ({
            documents: {
              ...state.documents,
              [docId]: { ...doc, folderId: folderId ?? undefined },
            },
          }))

          try {
            const res = await apiFetch(`/api/documents/${docId}/move`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ folderId }),
            })

            if (!res.ok) throw new Error('Move failed')

            const folderName = folderId ? folders[folderId]?.name : 'Root'
            toast.success(`Moved "${doc.name}" to ${folderName}`)
            get().fetchFolders()
          } catch (error) {
            // Revert optimistic update
            set((state) => ({
              documents: {
                ...state.documents,
                [docId]: doc,
              },
            }))
            toast.error('Failed to move document')
            throw error
          }
        },
      }),
      {
        name: 'ragbox-vault',
        partialize: (state) => ({
          isCollapsed: state.isCollapsed,
        }),
      }
    )
  )
)
