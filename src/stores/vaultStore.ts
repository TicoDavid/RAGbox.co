import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { VaultItem, FolderNode } from '@/types/ragbox'

interface VaultState {
  // Data
  documents: Record<string, VaultItem>
  folders: Record<string, FolderNode>

  // UI State
  isCollapsed: boolean
  currentPath: string[]
  selectedItemId: string | null
  isLoading: boolean
  error: string | null

  // Storage
  storage: { used: number; total: number }

  // Actions
  toggleCollapse: () => void
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
        currentPath: [],
        selectedItemId: null,
        isLoading: false,
        error: null,
        storage: { used: 0, total: 1073741824 },

        toggleCollapse: () => set((state) => ({ isCollapsed: !state.isCollapsed })),

        navigate: (path) => set({ currentPath: path, selectedItemId: null }),

        selectItem: (id) => set({ selectedItemId: id }),

        fetchDocuments: async () => {
          set({ isLoading: true, error: null })
          try {
            const res = await fetch('/api/documents')
            if (!res.ok) throw new Error('Failed to fetch documents')
            const data = await res.json()
            const documents: Record<string, VaultItem> = {}
            for (const doc of data.documents) {
              documents[doc.id] = {
                id: doc.id,
                name: doc.name,
                originalName: doc.originalName,
                type: 'document',
                mimeType: doc.mimeType,
                size: doc.size,
                createdAt: new Date(doc.uploadedAt),
                updatedAt: new Date(doc.updatedAt),
                parentId: doc.folderId,
                folderId: doc.folderId,
                status: doc.status,
                isPrivileged: doc.isPrivileged,
                securityTier: doc.securityTier ?? 0,
                deletionStatus: doc.deletionStatus,
              }
            }
            set({ documents, isLoading: false })
          } catch (error) {
            set({ error: (error as Error).message, isLoading: false })
          }
        },

        fetchFolders: async () => {
          try {
            const res = await fetch('/api/documents/folders')
            if (!res.ok) throw new Error('Failed to fetch folders')
            const data = await res.json()
            const folders: Record<string, FolderNode> = {}
            for (const folder of data.folders) {
              folders[folder.id] = {
                id: folder.id,
                name: folder.name,
                parentId: folder.parentId,
                children: folder.children ?? [],
                documents: folder.documents ?? [],
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

          const res = await fetch('/api/documents/extract', {
            method: 'POST',
            body: formData,
          })

          if (!res.ok) throw new Error('Upload failed')
          get().fetchDocuments()
        },

        deleteDocument: async (id) => {
          set((state) => {
            const { [id]: _deleted, ...rest } = state.documents
            return { documents: rest }
          })

          try {
            const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Delete failed')
          } catch (error) {
            get().fetchDocuments()
            throw error
          }
        },

        updateDocument: async (id, updates) => {
          const res = await fetch(`/api/documents/${id}`, {
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

          const res = await fetch(`/api/documents/${id}/privilege`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              privileged: !doc.isPrivileged,
              filename: doc.name,
            }),
          })

          if (!res.ok) throw new Error('Privilege toggle failed')

          set((state) => ({
            documents: {
              ...state.documents,
              [id]: { ...state.documents[id], isPrivileged: !doc.isPrivileged },
            },
          }))
        },

        createFolder: async (name, parentId) => {
          const res = await fetch('/api/documents/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, parentId }),
          })

          if (!res.ok) throw new Error('Folder creation failed')
          get().fetchFolders()
        },

        deleteFolder: async (id) => {
          const res = await fetch(`/api/documents/folders?id=${id}`, {
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
