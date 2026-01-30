'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { DocumentDTO } from '@/types/api'
import type { DeletionStatus } from '@/types/models'

/**
 * Backwards-compatible re-exports
 */
export type { DeletionStatus } from '@/types/models'
export type Document = DocumentDTO
export type { DocumentDTO }

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
  documents: DocumentDTO[]
  isLoading: boolean
  error: string | null
  total: number
  refetch: () => Promise<void>
  deleteDocument: (id: string) => Promise<boolean>
  updateDocument: (id: string, updates: Partial<DocumentDTO>) => Promise<DocumentDTO | null>
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

  const [documents, setDocuments] = useState<DocumentDTO[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)

  // Ref to track current documents, fixing stale closure in togglePrivilege
  const documentsRef = useRef(documents)
  documentsRef.current = documents

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

  const deleteDocument = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete document')
      }

      setDocuments((prev) => prev.filter((doc) => doc.id !== id))
      setTotal((prev) => prev - 1)

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document')
      return false
    }
  }, [])

  const updateDocument = useCallback(
    async (id: string, updates: Partial<DocumentDTO>): Promise<DocumentDTO | null> => {
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

  const togglePrivilege = useCallback(
    async (id: string, privileged: boolean, confirmUnmark = false): Promise<boolean> => {
      try {
        // Use ref to avoid stale closure over documents state
        const document = documentsRef.current.find((doc) => doc.id === id)

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

          if (errorData.code === 'PRIVILEGE_MODE_SAFETY') {
            setError('Cannot remove privilege protection while in Privileged Mode')
            return false
          }

          if (errorData.code === 'CONFIRM_UNMARK_REQUIRED') {
            return false
          }

          throw new Error(errorData.error || 'Failed to update privilege')
        }

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
    []
  )

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
