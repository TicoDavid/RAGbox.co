/**
 * UI View Model Types - RAGbox.co
 *
 * Frontend-only state that never crosses the network.
 */

import type { ChatCitationDTO } from './api'
import type { ReasoningTrace } from './reasoning'

// ============================================
// Chat UI Types
// ============================================

export type ChatMessageRole = 'user' | 'assistant' | 'system'
export type ChatMessageType = 'user' | 'ai_response' | 'system_event' | 'security_alert' | 'error'

export interface ChatMessage {
  id: string
  role: ChatMessageRole
  text: string
  isUser: boolean
  timestamp: number
  isStreaming?: boolean
  confidence?: number
  citations?: ChatCitationDTO[]
  reasoningTrace?: ReasoningTrace
  groundingMetadata?: GroundingMetadata
  type?: ChatMessageType
}

export interface UseChatOptions {
  endpoint?: string
  stream?: boolean
  privilegeMode?: boolean
  maxTier?: number
  systemPrompt?: string
  onMessageComplete?: (message: ChatMessage) => void
  onError?: (error: Error) => void
}

export interface UseChatReturn {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  sendMessage: (text: string) => Promise<void>
  clearMessages: () => void
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
}

// ============================================
// Document UI Types
// ============================================

export type DocumentSort = 'name' | 'date' | 'size'
export type SortOrder = 'asc' | 'desc'

export interface UseDocumentsOptions {
  autoFetch?: boolean
  sort?: DocumentSort
  order?: SortOrder
  privilegedFilter?: 'true' | 'false' | 'all'
  statusFilter?: 'pending' | 'processing' | 'ready' | 'error' | 'all'
}

export interface UseDocumentsReturn {
  documents: import('./api').DocumentDTO[]
  isLoading: boolean
  error: string | null
  total: number
  refetch: () => Promise<void>
  deleteDocument: (id: string) => Promise<boolean>
  updateDocument: (id: string, updates: Partial<import('./api').DocumentDTO>) => Promise<import('./api').DocumentDTO | null>
  togglePrivilege: (id: string, privileged: boolean, confirmUnmark?: boolean) => Promise<boolean>
}

// ============================================
// Dashboard Types (moved from dashboard/types.ts)
// ============================================

export type ArtifactType = 'ui' | 'image' | 'video' | 'chart'

export interface Artifact {
  id: string
  type: ArtifactType
  styleName: string
  title: string
  content: string
  status: 'streaming' | 'generating' | 'complete' | 'error'
  sourceInsightId?: string
  handoffPayload?: InsightHandoffPayload
}

export type InsightType = 'data_trend' | 'risk_assessment' | 'key_clause' | 'comparison' | 'recommendation'

export interface InsightHandoffPayload {
  source_insight_id: string
  artifact_type: ArtifactType
  context_data: {
    title: string
    key_datapoints?: Record<string, string>
    summary_text: string
    source_citations: string[]
    insight_type: InsightType
  }
  requested_at: number
}

export interface ParsedInsight {
  id: string
  sourceMessageId: string
  type: InsightType
  title: string
  content: string
  keyDatapoints?: Record<string, string>
  sourceCitations: string[]
}

export interface DrawerState {
  isOpen: boolean
  mode: 'code' | 'variations' | 'history' | null
  title: string
  data: unknown
}

export type StudioMode = 'UI' | 'ASSET' | 'CHART' | 'VISION' | 'VIDEO'

export type ForgeState = 'idle' | 'receiving_intel' | 'forging' | 'complete'

export interface ForgeContext {
  state: ForgeState
  incomingPayload: InsightHandoffPayload | null
  animationTitle: string
  progress: number
}

export interface Source {
  id: number
  title: string
  type: 'text' | 'image'
  time: string
  isNew: boolean
  content?: string
  base64?: string
  mimeType?: string
  securityTier?: number
}

export interface SystemAuditEvent {
  id: string
  timestamp: number
  category: 'SYSTEM' | 'INGEST' | 'TRANSFER' | 'SECURITY' | 'VAULT'
  message: string
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[]
}

export interface GroundingChunk {
  web?: {
    uri: string
    title?: string
  }
}

export type VaultUIStatus = 'secure' | 'open' | 'closed'

export interface VaultUI {
  id: string
  name: string
  status: VaultUIStatus
  tenantId: string
  documentCount: number
  storageUsedBytes: number
  createdAt: Date
}
