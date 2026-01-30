/**
 * Canonical Domain Models - RAGbox.co
 *
 * Single source of truth for entity shapes, derived 1:1 from prisma/schema.prisma.
 * Every field name matches Prisma's camelCase. Enums are string literal unions.
 */

// ============================================
// Enums
// ============================================

export type UserRole = 'Partner' | 'Associate' | 'Auditor'

export type UserStatus = 'Active' | 'Suspended'

export type IndexStatus = 'Pending' | 'Processing' | 'Indexed' | 'Failed'

export type DeletionStatus = 'Active' | 'SoftDeleted' | 'HardDeleted'

export type VaultStatus = 'open' | 'closed' | 'secure'

export type QueryOutcome = 'Answered' | 'Refused'

export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'DOCUMENT_UPLOAD'
  | 'DOCUMENT_DELETE'
  | 'DOCUMENT_VIEW'
  | 'DOCUMENT_PRIVILEGE_CHANGE'
  | 'QUERY_SUBMITTED'
  | 'QUERY_RESPONSE'
  | 'SILENCE_PROTOCOL_TRIGGERED'
  | 'PRIVILEGE_MODE_CHANGE'
  | 'DATA_EXPORT'
  | 'ERROR'

export type AuditSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'

// ============================================
// Entities
// ============================================

export interface User {
  id: string
  email: string
  name: string | null
  image: string | null
  role: UserRole
  status: UserStatus
  privilegeModeEnabled: boolean
  privilegeModeChangedAt: Date | null
  createdAt: Date
  lastLoginAt: Date | null
}

export interface Vault {
  id: string
  name: string
  userId: string
  status: VaultStatus
  documentCount: number
  storageUsedBytes: bigint
  createdAt: Date
  updatedAt: Date
}

export interface Document {
  id: string
  vaultId: string | null
  userId: string
  filename: string
  originalName: string
  mimeType: string
  fileType: string
  sizeBytes: number
  storageUri: string | null
  storagePath: string | null
  extractedText: string | null
  indexStatus: IndexStatus
  deletionStatus: DeletionStatus
  isPrivileged: boolean
  securityTier: number
  chunkCount: number
  checksum: string | null
  folderId: string | null
  metadata: unknown
  deletedAt: Date | null
  hardDeleteAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface DocumentChunk {
  id: string
  documentId: string
  chunkIndex: number
  content: string
  contentHash: string
  tokenCount: number
  createdAt: Date
}

export interface Query {
  id: string
  userId: string
  queryText: string
  confidenceScore: number | null
  outcome: QueryOutcome
  privilegeMode: boolean
  chunksUsed: number
  latencyMs: number | null
  model: string | null
  createdAt: Date
}

export interface Answer {
  id: string
  queryId: string
  answerText: string
  createdAt: Date
}

export interface Citation {
  id: string
  answerId: string
  documentId: string
  chunkId: string | null
  relevanceScore: number
  excerpt: string | null
  citationIndex: number
}

export interface AuditLog {
  id: string
  userId: string | null
  action: string
  resourceId: string | null
  resourceType: string | null
  severity: string
  details: unknown
  detailsHash: string | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

export interface Folder {
  id: string
  name: string
  userId: string
  parentId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Template {
  id: string
  name: string
  description: string | null
  userId: string
  category: string | null
  sections: unknown
  fields: unknown
  structure: unknown
  confidence: number | null
  sourceFile: string | null
  storageUri: string | null
  thumbnail: string | null
  usageCount: number
  createdAt: Date
  updatedAt: Date
}

export interface WaitlistEntry {
  id: string
  email: string
  source: string | null
  referrer: string | null
  ipAddress: string | null
  createdAt: Date
}
