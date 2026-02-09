/**
 * Sovereign Studio - Type Definitions
 *
 * Types for the document factory / artifact generation system.
 */

export type ArtifactType =
  | 'audio'
  | 'video'
  | 'mindmap'
  | 'report'
  | 'compliance'
  | 'infographic'
  | 'deck'
  | 'evidence'

export type ToneType = 'standard' | 'executive' | 'forensic'

export interface BrandConfig {
  wordTemplateUrl?: string
  slideTemplateUrl?: string
  tone: ToneType
  companyName?: string
}

export interface GenerationRequest {
  artifactType: ArtifactType
  sourceDocumentIds: string[]
  brandConfig: BrandConfig
  title?: string
  additionalInstructions?: string
}

export interface GenerationResult {
  success: boolean
  artifactId: string
  fileName: string
  fileType: string
  mimeType: string
  downloadUrl: string
  previewContent?: string
  metadata: {
    generatedAt: string
    sourceDocuments: number
    tone: ToneType
    processingTimeMs: number
  }
}

export interface ArtifactRecord {
  id: string
  userId: string
  artifactType: ArtifactType
  fileName: string
  fileType: string
  mimeType: string
  gcsUri: string
  downloadUrl: string
  sourceDocumentIds: string[]
  brandConfig: BrandConfig
  createdAt: string
  expiresAt: string
}

// Slide structure for deck generation
export interface SlideContent {
  slideNumber: number
  title: string
  bullets: string[]
  speakerNotes?: string
  layout: 'title' | 'bullets' | 'two-column' | 'image-text'
}

export interface DeckStructure {
  title: string
  subtitle?: string
  slides: SlideContent[]
  appendix?: SlideContent[]
}

// Mind map structure
export interface MindMapNode {
  id: string
  label: string
  children?: MindMapNode[]
  color?: string
}

export interface MindMapStructure {
  title: string
  root: MindMapNode
}

// Compliance drill structure
export interface FlashCard {
  question: string
  answer: string
  category: string
  difficulty: 'easy' | 'medium' | 'hard'
}

export interface ComplianceDrill {
  title: string
  description: string
  cards: FlashCard[]
  quiz: {
    question: string
    options: string[]
    correctIndex: number
    explanation: string
  }[]
}

// Evidence log structure
export interface EvidenceEntry {
  id: string
  documentSource: string
  excerpt: string
  category: string
  significance: 'low' | 'medium' | 'high' | 'critical'
  pageReference?: string
  notes?: string
}

export interface EvidenceLog {
  title: string
  generatedAt: string
  entries: EvidenceEntry[]
  summary: string
}

// Audio/Video script structure
export interface ScriptSection {
  sectionTitle: string
  content: string
  durationEstimate: number // seconds
  visualCue?: string // for video
}

export interface NarrationScript {
  title: string
  introduction: string
  sections: ScriptSection[]
  conclusion: string
  totalDuration: number
}
