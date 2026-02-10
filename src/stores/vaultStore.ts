import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { VaultItem, FolderNode } from '@/types/ragbox'
import { apiFetch } from '@/lib/api'

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

  // API Actions
  fetchDocuments: () => Promise<void>
  fetchFolders: () => Promise<void>
  uploadDocument: (file: File, folderId?: string) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  updateDocument: (id: string, updates: Partial<VaultItem>) => Promise<void>
  togglePrivilege: (id: string) => Promise<void>

  // Folder Actions
  createFolder: (name: string, parentId?: string) => Promise<void>
  deleteFolder: (id: string) => Promise<void>
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
        storage: { used: 0, total: 1073741824 },

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

        fetchDocuments: async () => {
          set({ isLoading: true, error: null })
          try {
            const res = await apiFetch('/api/documents')
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
          } catch (error) {
            console.error('Failed to fetch folders:', error)
          }
        },

        uploadDocument: async (file, folderId) => {
          const formData = new FormData()
          formData.append('file', file)
          if (folderId) formData.append('folderId', folderId)

          // Step 1: Extract text and upload to GCS
          const extractRes = await apiFetch('/api/documents/extract', {
            method: 'POST',
            body: formData,
          })

          if (!extractRes.ok) throw new Error('Upload failed')
          const extractResult = await extractRes.json()

          // Step 2: Create document record in database
          // Use mimeType from extract result (which handles empty file.type for .md files)
          const mimeType = extractResult.data.mimeType || file.type || 'application/octet-stream'

          const createRes = await apiFetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name,
              size: file.size,
              mimeType,
              storagePath: extractResult.data.storagePath,
              storageUri: extractResult.data.gcsUri,
              ...(folderId ? { folderId } : {}),
            }),
          })

          if (!createRes.ok) throw new Error('Failed to create document record')

          get().fetchDocuments()
        },

        deleteDocument: async (id) => {
          set((state) => {
            const { [id]: _deleted, ...rest } = state.documents
            return { documents: rest }
          })

          try {
            const res = await apiFetch(`/api/documents/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Delete failed')
          } catch (error) {
            get().fetchDocuments()
            throw error
          }
        },

        updateDocument: async (id, updates) => {
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
        },

        togglePrivilege: async (id) => {
          const doc = get().documents[id]
          if (!doc) return

          const newPrivileged = !doc.isPrivileged

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
        },

        createFolder: async (name, parentId) => {
          const res = await apiFetch('/api/documents/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, parentId }),
          })

          if (!res.ok) throw new Error('Folder creation failed')
          get().fetchFolders()
        },

        deleteFolder: async (id) => {
          const res = await apiFetch(`/api/documents/folders?id=${id}`, {
            method: 'DELETE',
          })

          if (!res.ok) throw new Error('Folder deletion failed')
          get().fetchFolders()
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
