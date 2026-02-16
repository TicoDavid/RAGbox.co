/**
 * Unified Type Definitions - RAGbox.co UI v2.0
 *
 * Single source of truth for all UI types in the redesigned dashboard.
 */

// ===== Enums =====

export type UserRole = 'Partner' | 'Associate' | 'Auditor'
export type UserStatus = 'Active' | 'Suspended'
export type IndexStatus = 'Pending' | 'Processing' | 'Indexed' | 'Failed'
export type DeletionStatus = 'Active' | 'SoftDeleted' | 'HardDeleted'
export type QueryOutcome = 'Answered' | 'Refused'
export type VaultStatus = 'open' | 'closed' | 'secure'

export type SecurityTier = 0 | 1 | 2 | 3 | 4
export const SECURITY_TIER_LABELS: Record<SecurityTier, string> = {
  0: 'DropZone',
  1: 'Standard',
  2: 'Sensitive',
  3: 'Confidential',
  4: 'Privileged',
}

// ===== Core Entities =====

export interface User {
  id: string
  email: string
  name?: string
  role: UserRole
  status: UserStatus
  privilegeModeEnabled: boolean
  createdAt: Date
  lastLoginAt?: Date
}

export interface Vault {
  id: string
  name: string
  userId: string
  status: VaultStatus
  documentCount: number
  storageUsedBytes: number
  createdAt: Date
  updatedAt: Date
}

export interface Document {
  id: string
  vaultId?: string
  userId: string
  filename: string
  originalName: string
  mimeType: string
  fileType: string
  sizeBytes: number
  storageUri?: string
  storagePath?: string
  extractedText?: string
  indexStatus: IndexStatus
  deletionStatus: DeletionStatus
  isPrivileged: boolean
  securityTier: SecurityTier
  chunkCount: number
  checksum?: string
  folderId?: string
  metadata?: Record<string, unknown>
  deletedAt?: Date
  hardDeleteAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface Folder {
  id: string
  name: string
  userId: string
  parentId?: string
  createdAt: Date
  updatedAt: Date
}

// ===== Vault Browser Types =====

export interface VaultItem {
  id: string
  name: string
  originalName: string
  type: 'folder' | 'document'
  mimeType?: string
  size?: number
  createdAt: Date
  updatedAt: Date
  parentId?: string
  folderId?: string
  status: 'pending' | 'processing' | 'ready' | 'error' | 'Pending' | 'Processing' | 'Indexed' | 'Failed'
  isPrivileged: boolean
  isStarred: boolean
  securityTier: number
  deletionStatus: DeletionStatus
  checksum?: string // SHA-256 hash for integrity verification
}

export interface FolderNode {
  id: string
  name: string
  parentId?: string
  children: string[]
  documents: string[]
}

// ===== Chat Types =====

export type MercuryChannel = 'dashboard' | 'whatsapp' | 'voice' | 'roam'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  confidence?: number
  citations?: Citation[]
  reasoningTrace?: ReasoningStep[]
  isError?: boolean
  channel?: MercuryChannel
  metadata?: Record<string, unknown>
}

export interface Citation {
  citationIndex: number
  documentId: string
  documentName: string
  chunkId?: string
  excerpt: string
  relevanceScore: number
  securityTier?: SecurityTier
}

export interface ReasoningStep {
  id: string
  label: string
  description: string
  status: 'pending' | 'running' | 'complete' | 'error'
  durationMs?: number
  metadata?: Record<string, unknown>
}

// ===== API Types =====

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface QueryRequest {
  message: string
  privilegeMode: boolean
  vaultIds?: string[]
  history?: { role: 'user' | 'assistant'; content: string }[]
}

export interface QueryResponse {
  answer: string
  citations: Citation[]
  confidence: number
}

// ===== Forge Types =====

export type AssetType = 'pdf' | 'report' | 'slides' | 'chart' | 'image' | 'table'

export interface GeneratedAsset {
  id: string
  type: AssetType
  filename: string
  createdAt: Date
  size: number
  downloadUrl: string
  status: 'generating' | 'complete' | 'error'
}

// ===== Temperature Presets =====

export type TemperaturePreset =
  | 'executive-ceo'
  | 'executive-coo'
  | 'executive-cpo'
  | 'executive-cmo'
  | 'executive-cto'
  | 'executive-cfo'
  | 'legal'
  | 'hipaa'

export const TEMPERATURE_PRESETS: Record<TemperaturePreset, { label: string; icon: string; category: string; description: string }> = {
  'executive-ceo': { label: 'CEO', icon: '👔', category: 'EXECUTIVE', description: 'Strategic, high-level summaries' },
  'executive-coo': { label: 'COO', icon: '📊', category: 'EXECUTIVE', description: 'Operations-focused analysis' },
  'executive-cpo': { label: 'CPO', icon: '🎯', category: 'EXECUTIVE', description: 'Product-centric insights' },
  'executive-cmo': { label: 'CMO', icon: '📣', category: 'EXECUTIVE', description: 'Marketing and positioning focus' },
  'executive-cto': { label: 'CTO', icon: '💻', category: 'EXECUTIVE', description: 'Technical depth and architecture' },
  'executive-cfo': { label: 'CFO', icon: '💰', category: 'EXECUTIVE', description: 'Financial analysis and metrics' },
  'legal': { label: 'Legal', icon: '⚖️', category: 'COMPLIANCE', description: 'Compliance and risk language' },
  'hipaa': { label: 'HIPAA', icon: '🏥', category: 'COMPLIANCE', description: 'Healthcare privacy compliant' },
}

// ===== Constants =====

export const CONFIDENCE_THRESHOLD = 0.85
export const SILENCE_PROTOCOL_THRESHOLD = 0.68

// ===== Content Intelligence =====

export interface ContentGap {
  id: string
  userId: string
  queryText: string
  confidenceScore: number
  suggestedTopics: string[]
  status: 'open' | 'addressed' | 'dismissed'
  addressedAt?: Date
  createdAt: Date
}

export interface ContentGapSummary {
  openGaps: number
}

export interface KBHealthCheck {
  id: string
  vaultId: string
  checkType: 'freshness' | 'coverage' | 'integrity'
  status: 'passed' | 'warning' | 'failed'
  details: Record<string, unknown>
  runAt: Date
}

export interface LearningSession {
  id: string
  userId: string
  vaultId?: string
  status: 'active' | 'paused' | 'completed'
  topicsCovered: string[]
  documentsQueried: string[]
  queryCount: number
  totalDurationMs: number
  createdAt: Date
  updatedAt: Date
}
