/**
 * Document Store - RAGbox.co
 *
 * Shared document storage module used by API routes.
 * In production, replace with database operations.
 */

/**
 * Storage limits for document uploads (PRD compliance)
 */
export const STORAGE_LIMITS = {
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024,           // 100MB per file
  MAX_DOCUMENTS_PER_VAULT: 1000,
  MAX_VAULT_STORAGE_BYTES: 50 * 1024 * 1024 * 1024  // 50GB per vault
} as const

export type DeletionStatus = 'Active' | 'SoftDeleted' | 'HardDeleted'

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

// In-memory document store (replace with database in production)
// Shared across requests via module scope
const documentStore = new Map<string, Document>()

// Initialize with demo documents
function initDemoDocuments() {
  if (documentStore.size > 0) return

  const demoUserId = 'demo_user'
  const documents: Document[] = [
    {
      id: 'doc_1',
      name: 'Contract_NDA_2024.pdf',
      originalName: 'Contract_NDA_2024.pdf',
      size: 2450000,
      type: 'pdf',
      mimeType: 'application/pdf',
      storagePath: `users/${demoUserId}/documents/doc_1.pdf`,
      uploadedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      userId: demoUserId,
      isPrivileged: false,
      chunkCount: 15,
      status: 'ready',
      deletionStatus: 'Active',
      deletedAt: null,
      hardDeleteScheduledAt: null,
    },
    {
      id: 'doc_2',
      name: 'Financial_Statement_Q4.xlsx',
      originalName: 'Financial_Statement_Q4.xlsx',
      size: 1200000,
      type: 'xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      storagePath: `users/${demoUserId}/documents/doc_2.xlsx`,
      uploadedAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
      userId: demoUserId,
      isPrivileged: true,
      chunkCount: 8,
      status: 'ready',
      deletionStatus: 'Active',
      deletedAt: null,
      hardDeleteScheduledAt: null,
    },
    {
      id: 'doc_3',
      name: 'Legal_Brief_v3.docx',
      originalName: 'Legal_Brief_v3.docx',
      size: 890000,
      type: 'docx',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      storagePath: `users/${demoUserId}/documents/doc_3.docx`,
      uploadedAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
      userId: demoUserId,
      isPrivileged: false,
      chunkCount: 12,
      status: 'ready',
      deletionStatus: 'Active',
      deletedAt: null,
      hardDeleteScheduledAt: null,
    },
    {
      id: 'doc_4',
      name: 'Attorney_Client_Memo.pdf',
      originalName: 'Attorney_Client_Memo.pdf',
      size: 456000,
      type: 'pdf',
      mimeType: 'application/pdf',
      storagePath: `users/${demoUserId}/documents/doc_4.pdf`,
      uploadedAt: new Date(Date.now() - 7200000).toISOString(),
      updatedAt: new Date(Date.now() - 7200000).toISOString(),
      userId: demoUserId,
      isPrivileged: true,
      chunkCount: 6,
      status: 'ready',
      deletionStatus: 'Active',
      deletedAt: null,
      hardDeleteScheduledAt: null,
    },
  ]

  documents.forEach((doc) => documentStore.set(doc.id, doc))
}

// Initialize demo data on module load
initDemoDocuments()

/**
 * Get the document store
 */
export function getDocumentStore(): Map<string, Document> {
  initDemoDocuments()
  return documentStore
}

/**
 * Get a document by ID
 */
export function getDocument(id: string): Document | undefined {
  initDemoDocuments()
  return documentStore.get(id)
}

/**
 * Add or update a document
 */
export function setDocument(doc: Document): void {
  documentStore.set(doc.id, doc)
}

/**
 * Delete a document
 */
export function deleteDocument(id: string): boolean {
  return documentStore.delete(id)
}

/**
 * Get documents for a user
 */
export function getDocumentsForUser(userId: string): Document[] {
  initDemoDocuments()
  return Array.from(documentStore.values()).filter(doc => doc.userId === userId)
}
