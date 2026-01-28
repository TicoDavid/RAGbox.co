// ===========================================
// CLI Configuration Types
// ===========================================

export interface CLIConfig {
  apiUrl: string
  authToken?: string
  defaultVaultId?: string
  outputFormat: 'json' | 'table' | 'plain'
  verbose: boolean
}

export const DEFAULT_CONFIG: CLIConfig = {
  apiUrl: 'http://localhost:3000',
  outputFormat: 'table',
  verbose: false,
}

// ===========================================
// API Types (mirrored from main app)
// ===========================================

export type UserRole = 'Partner' | 'Associate' | 'Auditor'
export type UserStatus = 'Active' | 'Suspended'
export type IndexStatus = 'Pending' | 'Indexed' | 'Failed'
export type DeletionStatus = 'Active' | 'SoftDeleted' | 'HardDeleted'
export type QueryOutcome = 'Answered' | 'Refused'
export type PrivilegeStatus = 'Public' | 'Privileged'

export interface User {
  user_id: string
  email: string
  role: UserRole
  status: UserStatus
  created_at: string
  last_login_at: string
}

export interface Vault {
  vault_id: string
  tenant_id: string
  name: string
  document_count: number
  storage_used_bytes: number
  created_at: string
}

export interface Document {
  document_id: string
  vault_id: string
  filename: string
  mime_type: string
  size_bytes: number
  uploaded_by: string
  uploaded_at: string
  storage_uri: string
  index_status: IndexStatus
  deletion_status: DeletionStatus
  privilege_status: PrivilegeStatus
  deleted_at: string | null
  checksum: string
}

export interface Citation {
  citation_id: string
  document_id: string
  chunk_id: string
  relevance_score: number
  excerpt?: string
  document_name?: string
  page_number?: number
}

export interface QueryResponse {
  answer_id: string
  answer_text: string
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

export interface AuditEvent {
  event_id: string
  timestamp: string
  user_id: string
  role: UserRole
  action_type: string
  resource_id: string
  metadata: Record<string, unknown>
}

// ===========================================
// API Response Types
// ===========================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface AuthResponse {
  token: string
  user: User
  expires_at: string
}

export interface OTPResponse {
  success: boolean
  message: string
  otp?: string // Only in development mode
}

export interface UploadResponse {
  document: Document
  message: string
}

export interface DocumentListResponse {
  documents: Document[]
  total: number
  page: number
  pageSize: number
}

export interface VaultListResponse {
  vaults: Vault[]
  total: number
}

export interface AuditLogResponse {
  events: AuditEvent[]
  total: number
  page: number
  pageSize: number
}
