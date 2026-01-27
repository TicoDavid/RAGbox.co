// ===========================================
// Core Entity Types (from PRD Section 5A)
// ===========================================

export type UserRole = 'Partner' | 'Associate' | 'Auditor'
export type UserStatus = 'Active' | 'Suspended'
export type IndexStatus = 'Pending' | 'Indexed' | 'Failed'
export type DeletionStatus = 'Active' | 'SoftDeleted' | 'HardDeleted'
export type QueryOutcome = 'Answered' | 'Refused'

export interface User {
  user_id: string
  email: string
  role: UserRole
  status: UserStatus
  created_at: Date
  last_login_at: Date
}

export interface Vault {
  vault_id: string
  tenant_id: string
  name: string
  document_count: number
  storage_used_bytes: number
  created_at: Date
}

export interface Document {
  document_id: string
  vault_id: string
  filename: string
  mime_type: string
  size_bytes: number
  uploaded_by: string
  uploaded_at: Date
  storage_uri: string
  index_status: IndexStatus
  deletion_status: DeletionStatus
  deleted_at: Date | null
  hard_delete_scheduled_at: Date | null
  checksum: string
  security_tier: number
}

export interface DocumentChunk {
  chunk_id: string
  document_id: string
  content_hash: string
  chunk_index: number
  // embedding_vector is never exposed to UI
}

export interface Query {
  query_id: string
  user_id: string
  query_text: string
  submitted_at: Date
  confidence_score: number
  outcome: QueryOutcome
}

export interface Answer {
  answer_id: string
  query_id: string
  answer_text: string
  generated_at: Date
}

export interface Citation {
  citation_id: string
  answer_id: string
  document_id: string
  chunk_id: string
  relevance_score: number
  excerpt?: string
}

export interface AuditEvent {
  event_id: string
  timestamp: Date
  user_id: string
  role: UserRole
  action_type: string
  resource_id: string
  metadata: Record<string, unknown>
}

// ===========================================
// LLM Provider Types
// ===========================================

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

// ===========================================
// API Response Types
// ===========================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface QueryRequest {
  query: string
  vault_id: string
}

export interface QueryResponse {
  answer: Answer
  citations: Citation[]
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

// ===========================================
// Confidence Gate Types (from PRD Section 2.4)
// ===========================================

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

// ===========================================
// Error Types (from PRD Section 7)
// ===========================================

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
