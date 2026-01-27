/**
 * Document Store - RAGbox.co
 *
 * Prisma-backed document storage with fallback to in-memory for resilience.
 */

import prisma from '@/lib/prisma'

export const STORAGE_LIMITS = {
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024,
  MAX_DOCUMENTS_PER_VAULT: 1000,
  MAX_VAULT_STORAGE_BYTES: 50 * 1024 * 1024 * 1024,
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
  storageUri?: string
  uploadedAt: string
  updatedAt: string
  userId: string
  isPrivileged: boolean
  securityTier: number
  chunkCount: number
  status: 'pending' | 'processing' | 'ready' | 'error'
  metadata?: Record<string, unknown>
  deletionStatus: DeletionStatus
  deletedAt: string | null
  hardDeleteScheduledAt: string | null
  extractedText?: string
  vaultId?: string
  folderId?: string
}

/**
 * Map a Prisma document row to the Document interface
 */
function mapPrismaDocument(row: {
  id: string
  filename: string
  originalName: string
  sizeBytes: number
  fileType: string
  mimeType: string
  storagePath: string | null
  storageUri: string | null
  createdAt: Date
  updatedAt: Date
  userId: string
  isPrivileged: boolean
  securityTier: number
  chunkCount: number
  indexStatus: string
  metadata: unknown
  deletionStatus: string
  deletedAt: Date | null
  hardDeleteAt: Date | null
  extractedText: string | null
  vaultId: string | null
  folderId: string | null
}): Document {
  const statusMap: Record<string, Document['status']> = {
    Pending: 'pending',
    Processing: 'processing',
    Indexed: 'ready',
    Failed: 'error',
  }

  return {
    id: row.id,
    name: row.filename,
    originalName: row.originalName,
    size: row.sizeBytes,
    type: row.fileType,
    mimeType: row.mimeType,
    storagePath: row.storagePath ?? '',
    storageUri: row.storageUri ?? undefined,
    uploadedAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    userId: row.userId,
    isPrivileged: row.isPrivileged,
    securityTier: row.securityTier,
    chunkCount: row.chunkCount,
    status: statusMap[row.indexStatus] ?? 'pending',
    metadata: row.metadata as Record<string, unknown> | undefined,
    deletionStatus: row.deletionStatus as DeletionStatus,
    deletedAt: row.deletedAt?.toISOString() ?? null,
    hardDeleteScheduledAt: row.hardDeleteAt?.toISOString() ?? null,
    extractedText: row.extractedText ?? undefined,
    vaultId: row.vaultId ?? undefined,
    folderId: row.folderId ?? undefined,
  }
}

/**
 * Get a document by ID
 */
export async function getDocument(id: string): Promise<Document | undefined> {
  try {
    const row = await prisma.document.findUnique({ where: { id } })
    if (!row) return undefined
    return mapPrismaDocument(row)
  } catch (error) {
    console.error('getDocument failed:', error)
    return undefined
  }
}

/**
 * Create or update a document
 */
export async function setDocument(doc: Document): Promise<void> {
  const indexStatusMap: Record<string, string> = {
    pending: 'Pending',
    processing: 'Processing',
    ready: 'Indexed',
    error: 'Failed',
  }

  try {
    await prisma.document.upsert({
      where: { id: doc.id },
      create: {
        id: doc.id,
        filename: doc.name,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        fileType: doc.type,
        sizeBytes: doc.size,
        storagePath: doc.storagePath,
        storageUri: doc.storageUri ?? null,
        userId: doc.userId,
        isPrivileged: doc.isPrivileged,
        securityTier: doc.securityTier,
        chunkCount: doc.chunkCount,
        indexStatus: indexStatusMap[doc.status] as 'Pending' | 'Processing' | 'Indexed' | 'Failed',
        deletionStatus: doc.deletionStatus as 'Active' | 'SoftDeleted' | 'HardDeleted',
        metadata: doc.metadata ? JSON.parse(JSON.stringify(doc.metadata)) : undefined,
        deletedAt: doc.deletedAt ? new Date(doc.deletedAt) : null,
        hardDeleteAt: doc.hardDeleteScheduledAt ? new Date(doc.hardDeleteScheduledAt) : null,
        extractedText: doc.extractedText ?? null,
        vaultId: doc.vaultId ?? null,
        folderId: doc.folderId ?? null,
      },
      update: {
        filename: doc.name,
        storagePath: doc.storagePath,
        storageUri: doc.storageUri ?? null,
        isPrivileged: doc.isPrivileged,
        securityTier: doc.securityTier,
        chunkCount: doc.chunkCount,
        indexStatus: indexStatusMap[doc.status] as 'Pending' | 'Processing' | 'Indexed' | 'Failed',
        deletionStatus: doc.deletionStatus as 'Active' | 'SoftDeleted' | 'HardDeleted',
        metadata: doc.metadata ? JSON.parse(JSON.stringify(doc.metadata)) : undefined,
        deletedAt: doc.deletedAt ? new Date(doc.deletedAt) : null,
        hardDeleteAt: doc.hardDeleteScheduledAt ? new Date(doc.hardDeleteScheduledAt) : null,
        extractedText: doc.extractedText ?? null,
        vaultId: doc.vaultId ?? null,
        folderId: doc.folderId ?? null,
      },
    })
  } catch (error) {
    console.error('setDocument failed:', error)
    throw error
  }
}

/**
 * Soft-delete a document
 */
export async function deleteDocument(id: string): Promise<boolean> {
  try {
    const now = new Date()
    await prisma.document.update({
      where: { id },
      data: {
        deletionStatus: 'SoftDeleted',
        deletedAt: now,
        hardDeleteAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    })
    return true
  } catch (error) {
    console.error('deleteDocument failed:', error)
    return false
  }
}

/**
 * Get documents for a user
 */
export async function getDocumentsForUser(
  userId: string,
  options?: {
    deletionStatus?: DeletionStatus
    privileged?: boolean
    status?: string
    sort?: 'name' | 'date' | 'size'
    order?: 'asc' | 'desc'
    vaultId?: string
    folderId?: string
  }
): Promise<Document[]> {
  try {
    const where: Record<string, unknown> = {
      userId,
      deletionStatus: options?.deletionStatus ?? 'Active',
    }

    if (options?.privileged !== undefined) {
      where.isPrivileged = options.privileged
    }

    if (options?.status) {
      const statusMap: Record<string, string> = {
        pending: 'Pending',
        processing: 'Processing',
        ready: 'Indexed',
        error: 'Failed',
      }
      where.indexStatus = statusMap[options.status] ?? options.status
    }

    if (options?.vaultId) {
      where.vaultId = options.vaultId
    }

    if (options?.folderId !== undefined) {
      where.folderId = options.folderId
    }

    const orderByMap: Record<string, Record<string, string>> = {
      name: { filename: options?.order ?? 'asc' },
      date: { createdAt: options?.order ?? 'desc' },
      size: { sizeBytes: options?.order ?? 'desc' },
    }

    const rows = await prisma.document.findMany({
      where,
      orderBy: orderByMap[options?.sort ?? 'date'] ?? { createdAt: 'desc' },
    })

    return rows.map(mapPrismaDocument)
  } catch (error) {
    console.error('getDocumentsForUser failed:', error)
    return []
  }
}

/**
 * Get documents by security tier for query filtering
 */
export async function getDocumentsByTier(
  userId: string,
  maxTier: number,
  includePrivileged: boolean
): Promise<Document[]> {
  try {
    const where: Record<string, unknown> = {
      userId,
      deletionStatus: 'Active',
      indexStatus: 'Indexed',
      securityTier: { lte: maxTier },
    }

    if (!includePrivileged) {
      where.isPrivileged = false
    }

    const rows = await prisma.document.findMany({ where })
    return rows.map(mapPrismaDocument)
  } catch (error) {
    console.error('getDocumentsByTier failed:', error)
    return []
  }
}

/**
 * Update document security tier
 */
export async function updateDocumentTier(id: string, tier: number): Promise<Document | undefined> {
  try {
    const row = await prisma.document.update({
      where: { id },
      data: { securityTier: tier },
    })
    return mapPrismaDocument(row)
  } catch (error) {
    console.error('updateDocumentTier failed:', error)
    return undefined
  }
}

/**
 * Ensure user exists in DB (upsert from OAuth)
 */
export async function ensureUser(user: {
  id: string
  email: string
  name?: string
  image?: string
}): Promise<void> {
  try {
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
      },
      update: {
        name: user.name ?? undefined,
        image: user.image ?? undefined,
        lastLoginAt: new Date(),
      },
    })
  } catch (error) {
    console.error('ensureUser failed:', error)
  }
}
