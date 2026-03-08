import type { ChatMessage, Citation, TemperaturePreset, MercuryChannel } from '@/types/ragbox'
import type { ActiveIntelligence } from '@/contexts/SettingsContext'
import { logger } from '@/lib/logger'
import { useVaultStore } from '@/stores/vaultStore'

// ============================================================================
// TYPES
// ============================================================================

// Proactive Insight (EPIC-028 Phase 4)
export type InsightType = 'deadline' | 'expiring' | 'anomaly' | 'trend' | 'reminder'

export interface InsightData {
  id: string
  documentId?: string
  insightType: InsightType
  title: string
  summary: string
  relevanceScore: number
  expiresAt?: string
  acknowledged: boolean
  createdAt: string
}

// Ad-Hoc Attachment (Session-only, not persisted to Vault)
export interface SessionAttachment {
  id: string
  name: string
  type: 'file' | 'image' | 'url'
  mimeType?: string
  size?: number
  content?: string
  extractedText?: string
  url?: string
  status: 'pending' | 'processing' | 'ready' | 'error'
}

// LLM selection for BYOLLM
export interface SelectedLlm {
  provider: 'aegis' | 'byollm'
  model: string
}

// Persona/Lens for Neural Shift
export type PersonaId = 'ceo' | 'cfo' | 'coo' | 'cpo' | 'cmo' | 'cto' | 'legal' | 'compliance' | 'auditor' | 'whistleblower'

export interface MercuryState {
  // Tenant isolation
  _userId: string | null

  // Conversation
  messages: ChatMessage[]
  inputValue: string
  isStreaming: boolean
  streamingContent: string
  abortController: AbortController | null

  // Ad-Hoc Attachments
  attachments: SessionAttachment[]

  // Neural Shift
  activePersona: PersonaId
  isRefocusing: boolean

  // Session tracking
  activeSessionId: string | null
  sessionQueryCount: number
  sessionTopics: string[]

  // BYOLLM selection
  selectedLlm: SelectedLlm
  mercuryIntelligence: ActiveIntelligence

  // Context
  temperaturePreset: TemperaturePreset

  // Document scope (E24-001)
  documentScope: string | null
  documentScopeName: string | null

  // Cross-session memory (E24-002)
  sessionSummaries: Array<{ id: string; summary: string; topics: string[]; createdAt: string }>

  // Proactive Insights (EPIC-028 Phase 4)
  insights: InsightData[]

  // Tool Actions
  pendingAction: { type: string; payload: Record<string, unknown> } | null

  // Pending confirmation for send_email / send_sms
  pendingConfirmation: { type: string; payload: Record<string, unknown> } | null

  // Unified Thread
  threadId: string | null
  threadTitle: string | null
  threadLoaded: boolean
  titlePatched: boolean
  channelFilter: MercuryChannel | 'all'

  // Actions
  setInputValue: (value: string) => void
  sendMessage: (privilegeMode: boolean) => Promise<void>
  clearPendingAction: () => void
  stopStreaming: () => void
  clearConversation: () => void
  setTemperaturePreset: (preset: TemperaturePreset) => void

  // Attachment Actions
  addAttachment: (attachment: Omit<SessionAttachment, 'id' | 'status'>) => string
  removeAttachment: (id: string) => void
  updateAttachment: (id: string, updates: Partial<SessionAttachment>) => void
  clearAttachments: () => void

  // BYOLLM Actions
  setSelectedLlm: (llm: SelectedLlm) => void
  setMercuryIntelligence: (intel: ActiveIntelligence) => void

  // Document Scope Actions (E24-001)
  setDocumentScope: (docId: string | null, docName?: string | null) => void

  // Neural Shift Actions
  setPersona: (persona: PersonaId) => void
  triggerRefocus: () => void

  // Confirmation Actions
  clearPendingConfirmation: () => void
  confirmAction: () => Promise<void>
  denyAction: () => void

  // Proactive Insight Actions
  fetchInsights: () => Promise<void>
  acknowledgeInsight: (id: string) => Promise<void>
  addInsight: (content: string) => void
  dismissInsight: (id: string) => void

  // Tenant isolation
  resetForUser: (userId: string) => void

  // Unified Thread Actions
  loadThread: () => Promise<void>
  startNewThread: () => Promise<void>
  switchThread: (threadId: string) => Promise<void>
  patchThreadTitle: (title: string) => void
  setChannelFilter: (channel: MercuryChannel | 'all') => void
  filteredMessages: () => ChatMessage[]
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const AEGIS_INTELLIGENCE: ActiveIntelligence = {
  id: 'aegis-core',
  displayName: 'Aegis',
  provider: 'RAGbox',
  tier: 'native',
}

// ============================================================================
// HELPERS
// ============================================================================

// BUG-048: UUID pattern for detecting raw document IDs in citation names
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * BUG-048: Resolve document display name from vaultStore when the Go backend
 * returns a UUID or empty string instead of the actual filename.
 */
export function resolveDocumentName(documentId: string, backendName?: string): string {
  if (backendName && !UUID_RE.test(backendName)) return backendName
  const doc = useVaultStore.getState().documents[documentId]
  if (doc?.name) return doc.name
  return 'Document'
}

// Fire-and-forget persist to Mercury Thread API
export function persistToThread(
  threadId: string | null,
  role: 'user' | 'assistant',
  channel: MercuryChannel,
  content: string,
  confidence?: number,
  citations?: Citation[],
): void {
  if (!content.trim()) return
  const body: Record<string, unknown> = { role, channel, content }
  if (threadId) body.threadId = threadId
  if (confidence !== undefined) body.confidence = confidence
  if (citations) body.citations = citations

  fetch('/api/mercury/thread/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((err) => {
    logger.warn('[MercuryStore] Thread persist failed:', err)
  })
}

// Call Gemini Flash to generate a short thread title from the user query
export async function generateThreadTitle(query: string): Promise<string> {
  const res = await fetch('/api/mercury/thread/generate-title', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) return query.slice(0, 50)
  const data = await res.json()
  return data.title || query.slice(0, 50)
}

// Map server message to ChatMessage
export function mapServerMessage(
  m: { id: string; role: string; channel: string; content: string; confidence?: number; citations?: unknown; metadata?: Record<string, unknown>; createdAt: string }
): ChatMessage {
  return {
    id: m.id,
    role: m.role as 'user' | 'assistant',
    content: m.content,
    timestamp: new Date(m.createdAt),
    confidence: m.confidence ?? undefined,
    citations: m.citations as Citation[] | undefined,
    channel: m.channel as MercuryChannel,
    metadata: m.metadata ?? undefined,
  }
}
