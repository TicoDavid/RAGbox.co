/**
 * Dashboard Types for RAGbox
 */

export type ArtifactType = 'ui' | 'image' | 'video' | 'chart';

export interface Artifact {
  id: string;
  type: ArtifactType;
  styleName: string;
  title: string;
  content: string; // HTML for UI/Chart, Base64 for Image, URI for Video
  status: 'streaming' | 'generating' | 'complete' | 'error';
  sourceInsightId?: string;
  handoffPayload?: InsightHandoffPayload;
}

export interface Session {
  id: string;
  prompt: string;
  timestamp: number;
  artifacts: Artifact[];
}

export interface ComponentVariation {
  name: string;
  html: string;
}

export interface LayoutOption {
  name: string;
  css: string;
  previewHtml: string;
}

export interface Source {
  id: number;
  title: string;
  type: 'text' | 'image';
  time: string;
  isNew: boolean;
  content?: string; // Text content
  base64?: string; // Image content
  mimeType?: string;
  securityTier?: number; // 0-4 security tier
}

export type VaultStatus = 'secure' | 'open' | 'closed';

export interface Vault {
  id: string;
  name: string;
  status: VaultStatus;
  tenantId: string;
  documentCount: number;
  storageUsedBytes: number;
  createdAt: Date;
}

export type ChatMessageType = 'user' | 'ai_response' | 'system_event' | 'security_alert' | 'error';

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
  type?: ChatMessageType;
  groundingMetadata?: GroundingMetadata;
  reasoningTrace?: import('@/types/reasoning').ReasoningTrace;
  citations?: Array<{
    citationIndex: number;
    documentName: string;
    excerpt: string;
    relevanceScore: number;
    securityTier: number;
  }>;
  confidence?: number;
}

export interface SystemAuditEvent {
  id: string;
  timestamp: number;
  category: 'SYSTEM' | 'INGEST' | 'TRANSFER' | 'SECURITY' | 'VAULT';
  message: string;
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title?: string;
  };
}

export interface DrawerState {
  isOpen: boolean;
  mode: 'code' | 'variations' | 'history' | null;
  title: string;
  data: unknown;
}

export type StudioMode = 'UI' | 'ASSET' | 'CHART' | 'VISION' | 'VIDEO';

// Insight classification types
export type InsightType = 'data_trend' | 'risk_assessment' | 'key_clause' | 'comparison' | 'recommendation';

// Insight action configuration
export interface InsightAction {
  id: string;
  label: string;
  icon: string;
  artifactType: ArtifactType;
}

// Parsed insight block from AI response
export interface ParsedInsight {
  id: string;                     // "chat_msg_123_block_2"
  sourceMessageId: string;
  type: InsightType;
  title: string;
  content: string;
  keyDatapoints?: Record<string, string>;
  sourceCitations: string[];
}

// Handoff payload to Studio
export interface InsightHandoffPayload {
  source_insight_id: string;
  artifact_type: ArtifactType;
  context_data: {
    title: string;
    key_datapoints?: Record<string, string>;
    summary_text: string;
    source_citations: string[];
    insight_type: InsightType;
  };
  requested_at: number;
}

// Forge animation state
export type ForgeState = 'idle' | 'receiving_intel' | 'forging' | 'complete';

export interface ForgeContext {
  state: ForgeState;
  incomingPayload: InsightHandoffPayload | null;
  animationTitle: string;
  progress: number; // 0-100
}
