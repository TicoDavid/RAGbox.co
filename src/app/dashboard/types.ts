/**
 * Dashboard Types for RAGbox
 *
 * Re-exports shared types from @/types/ui.
 * Dashboard-local types (Session, ComponentVariation, etc.) remain here.
 */

// Re-export shared types so existing `import { X } from '../types'` still works
export type {
  ArtifactType,
  Artifact,
  InsightType,
  InsightHandoffPayload,
  ParsedInsight,
  DrawerState,
  StudioMode,
  StudioGenerationState,
  StudioContext,
  Source,
  SystemAuditEvent,
  GroundingMetadata,
  GroundingChunk,
  ChatMessageType,
  ChatMessage,
} from '@/types/ui'

export type { VaultUI as Vault, VaultUIStatus as VaultStatus } from '@/types/ui'

// ============================================
// Dashboard-local types
// ============================================

export interface Session {
  id: string;
  prompt: string;
  timestamp: number;
  artifacts: import('@/types/ui').Artifact[];
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

export interface InsightAction {
  id: string;
  label: string;
  icon: string;
  artifactType: import('@/types/ui').ArtifactType;
}
