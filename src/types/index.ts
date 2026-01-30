/**
 * Type Barrel - RAGbox.co
 *
 * Re-exports canonical types from models.ts and api.ts.
 * Non-overlapping types (LLM, Confidence, Error) remain here.
 * Existing imports continue to work via this barrel.
 */

// ============================================
// Re-exports from canonical modules
// ============================================

export type {
  UserRole,
  UserStatus,
  IndexStatus,
  DeletionStatus,
  VaultStatus,
  QueryOutcome,
  AuditAction,
  AuditSeverity,
  User,
  Vault,
  Document,
  DocumentChunk,
  Query,
  Answer,
  Citation,
  AuditLog,
  Folder,
  Template,
  WaitlistEntry,
} from './models'

export type { ApiResponse } from './api'

// ============================================
// Legacy PRD-style interfaces (snake_case)
// Kept for backwards compatibility with existing code
// ============================================

export interface AuditEvent {
  event_id: string
  timestamp: Date
  user_id: string
  role: import('./models').UserRole
  action_type: string
  resource_id: string
  metadata: Record<string, unknown>
}

// ============================================
// LLM Provider Types
// ============================================

export interface LLMResponse {
  text: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
  model: string
  confidence?: number
}

export interface LLMStreamChunk {
  text: string
  done: boolean
}

export interface LLMProviderConfig {
  provider: 'openrouter' | 'vertex-llama' | 'vertex-gemini'
  model: string
  apiKey?: string
  projectId?: string
  region?: string
}

// ============================================
// API Response Types (legacy snake_case)
// ============================================

export interface QueryRequest {
  query: string
  vault_id: string
}

export interface QueryResponse {
  answer: import('./models').Answer
  citations: import('./models').Citation[]
  confidence_score: number
  retrieval_coverage: number
  source_agreement: number
  model_certainty: number
}

export interface RefusalResponse {
  refused: true
  reason: string
  confidence_score: number
}

// ============================================
// Confidence Gate Types (from PRD Section 2.4)
// ============================================

export interface ConfidenceFactors {
  retrieval_coverage: number  // 0.4 weight
  source_agreement: number    // 0.4 weight
  model_certainty: number     // 0.2 weight
}

export function calculateConfidence(factors: ConfidenceFactors): number {
  return (
    factors.retrieval_coverage * 0.4 +
    factors.source_agreement * 0.4 +
    factors.model_certainty * 0.2
  )
}

export const CONFIDENCE_THRESHOLD = 0.85

// ============================================
// Error Types (from PRD Section 7)
// ============================================

export type ErrorCode =
  | 'VECTOR_DB_UNAVAILABLE'
  | 'VECTOR_DB_TIMEOUT'
  | 'NO_RELEVANT_CHUNKS'
  | 'INDEX_CORRUPTED'
  | 'LLM_UNAVAILABLE'
  | 'LLM_TIMEOUT'
  | 'LLM_CONTEXT_OVERFLOW'
  | 'LLM_SAFETY_BLOCK'
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_QUOTA_EXCEEDED'
  | 'DOCUMENT_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'SESSION_EXPIRED'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTERNAL_ERROR'
  | 'MAINTENANCE_MODE'

export type ErrorSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'

export interface AppError {
  error_id: string
  error_code: ErrorCode
  message: string
  user_message: string
  severity: ErrorSeverity
  timestamp: Date
  component: string
}
