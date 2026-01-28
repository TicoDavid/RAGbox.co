'use client'

import { useState, useCallback, useEffect } from 'react'

/**
 * Deletion status for soft-delete lifecycle
 */
export type DeletionStatus = 'Active' | 'SoftDeleted' | 'HardDeleted'

/**
 * Document interface matching the API response
 */
export interface Document {
  id: string
  name: string
  originalName: string
  size: number
  type: string
  mimeType: string
  storagePath: string
  uploadedAt: string
  updatedAt: string
  userId: string
  isPrivileged: boolean
  chunkCount: number
  status: 'pending' | 'processing' | 'ready' | 'error'
  metadata?: Record<string, unknown>
  deletionStatus: DeletionStatus
  deletedAt: string | null
  hardDeleteScheduledAt: string | null
}

/**
 * Sort options for documents
 */
export type DocumentSort = 'name' | 'date' | 'size'
export type SortOrder = 'asc' | 'desc'

/**
 * Hook options
 */
interface UseDocumentsOptions {
  autoFetch?: boolean
  sort?: DocumentSort
  order?: SortOrder
  privilegedFilter?: 'true' | 'false' | 'all'
  statusFilter?: 'pending' | 'processing' | 'ready' | 'error' | 'all'
}

/**
 * Hook return type
 */
interface UseDocumentsReturn {
  documents: Document[]
  isLoading: boolean
  error: string | null
  total: number
  refetch: () => Promise<void>
  deleteDocument: (id: string) => Promise<boolean>
  updateDocument: (id: string, updates: Partial<Document>) => Promise<Document | null>
  togglePrivilege: (id: string, privileged: boolean, confirmUnmark?: boolean) => Promise<boolean>
}

/**
 * Custom hook for managing documents
 *
 * Features:
 * - Fetches documents from API
 * - Provides delete functionality
 * - Provides privilege toggle
 * - Handles loading and error states
 */
export function useDocuments(options: UseDocumentsOptions = {}): UseDocumentsReturn {
  const {
    autoFetch = true,
    sort = 'date',
    order = 'desc',
    privilegedFilter = 'all',
    statusFilter = 'all',
  } = options

  const [documents, setDocuments] = useState<Document[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  /**
   * Fetch documents from API
   */
  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        sort,
        order,
        privileged: privilegedFilter,
        status: statusFilter,
      })

      const response = await fetch(`/api/documents?${params.toString()}`)

      if (!response.ok) {
        throw new Error('Failed to fetch documents')
      }

      const data = await response.json()
      setDocuments(data.documents)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [sort, order, privilegedFilter, statusFilter])

  /**
   * Delete a document
   */
  const deleteDocument = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete document')
      }

      // Optimistically remove from local state
      setDocuments((prev) => prev.filter((doc) => doc.id !== id))
      setTotal((prev) => prev - 1)

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document')
      return false
    }
  }, [])

  /**
   * Update document metadata
   */
  const updateDocument = useCallback(
    async (id: string, updates: Partial<Document>): Promise<Document | null> => {
      try {
        const response = await fetch(`/api/documents/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })

        if (!response.ok) {
          throw new Error('Failed to update document')
        }

        const data = await response.json()
        const updatedDoc = data.document

        // Update local state
        setDocuments((prev) =>
          prev.map((doc) => (doc.id === id ? updatedDoc : doc))
        )

        return updatedDoc
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update document')
        return null
      }
    },
    []
  )

  /**
   * Toggle document privilege status
   */
  const togglePrivilege = useCallback(
    async (id: string, privileged: boolean, confirmUnmark = false): Promise<boolean> => {
      try {
        const document = documents.find((doc) => doc.id === id)

        const response = await fetch(`/api/documents/${id}/privilege`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privileged,
            filename: document?.name,
            confirmUnmark,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()

          // Handle safety check errors
          if (errorData.code === 'PRIVILEGE_MODE_SAFETY') {
            setError('Cannot remove privilege protection while in Privileged Mode')
            return false
          }

          if (errorData.code === 'CONFIRM_UNMARK_REQUIRED') {
            // Caller should handle confirmation
            return false
          }

          throw new Error(errorData.error || 'Failed to update privilege')
        }

        // Update local state
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.id === id ? { ...doc, isPrivileged: privileged } : doc
          )
        )

        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update privilege')
        return false
      }
    },
    [documents]
  )

  // Auto-fetch on mount and when options change
  useEffect(() => {
    if (autoFetch) {
      fetchDocuments()
    }
  }, [autoFetch, fetchDocuments])

  return {
    documents,
    isLoading,
    error,
    total,
    refetch: fetchDocuments,
    deleteDocument,
    updateDocument,
    togglePrivilege,
  }
}
