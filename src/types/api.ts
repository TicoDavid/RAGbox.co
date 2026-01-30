/**
 * API DTO Types - RAGbox.co
 *
 * Shapes that cross the network boundary.
 * Dates become ISO strings, BigInt becomes number.
 */

import type { DeletionStatus, IndexStatus } from './models'

// ============================================
// Generic Envelope
// ============================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// ============================================
// Document DTOs
// ============================================

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'error'

/**
 * Document as it appears over the wire / in frontend state.
 * Field names match the existing store.ts Document interface exactly.
 */
export interface DocumentDTO {
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
  status: DocumentStatus
  metadata?: Record<string, unknown>
  deletionStatus: DeletionStatus
  deletedAt: string | null
  hardDeleteScheduledAt: string | null
  extractedText?: string
  vaultId?: string
  folderId?: string
}

/**
 * Mapping between Prisma IndexStatus and API DocumentStatus
 */
export const INDEX_STATUS_TO_DOCUMENT_STATUS: Record<IndexStatus, DocumentStatus> = {
  Pending: 'pending',
  Processing: 'processing',
  Indexed: 'ready',
  Failed: 'error',
}

export const DOCUMENT_STATUS_TO_INDEX_STATUS: Record<DocumentStatus, IndexStatus> = {
  pending: 'Pending',
  processing: 'Processing',
  ready: 'Indexed',
  error: 'Failed',
}

export interface DocumentListResponse {
  documents: DocumentDTO[]
  total: number
}

// ============================================
// Chat DTOs
// ============================================

export interface ChatRequest {
  message: string
  privilegeMode?: boolean
  maxTier?: number
  systemPrompt?: string
  stream?: boolean
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface ChatCitationDTO {
  citationIndex: number
  documentName: string
  excerpt: string
  relevanceScore: number
  securityTier: number
}

export interface ChatResponse {
  answer: string
  citations: ChatCitationDTO[]
  confidence: number
  silenceProtocol: boolean
  model: string
}

/**
 * SSE stream event discriminated union.
 * Each event arrives as `data: <json>\n\n` with a `type` discriminator.
 */
export type ChatStreamEvent =
  | { type: 'content'; content: string }
  | { type: 'citations'; citations: ChatCitationDTO[] }
  | { type: 'confidence'; confidence: number }
  | { type: 'reasoning'; step: string; status: string }
  | { type: 'done'; model: string }
  | { type: 'error'; message: string }

// ============================================
// Vault DTOs
// ============================================

export interface VaultDTO {
  id: string
  name: string
  status: 'open' | 'closed' | 'secure'
  userId: string
  documentCount: number
  storageUsedBytes: number
  createdAt: string
  updatedAt: string
}

// ============================================
// Audit DTOs
// ============================================

export interface AuditEventDTO {
  id: string
  timestamp: string
  userId: string | null
  action: string
  resourceId: string | null
  resourceType: string | null
  severity: string
  details: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
}

export interface AuditLogResponse {
  events: AuditEventDTO[]
  total: number
}

// ============================================
// Query DTOs
// ============================================

export interface QueryResponseDTO {
  answer: string
  citations: ChatCitationDTO[]
  confidence: number
  retrievalCoverage: number
  sourceAgreement: number
  modelCertainty: number
}

export interface RefusalResponseDTO {
  refused: true
  reason: string
  confidence: number
}
