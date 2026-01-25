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
}

export type VaultStatus = 'secure' | 'open' | 'closed';

export interface Vault {
  id: string;
  name: string;
  status: VaultStatus;
}

export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: number;
  groundingMetadata?: GroundingMetadata;
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
