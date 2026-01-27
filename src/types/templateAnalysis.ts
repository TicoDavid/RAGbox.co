/**
 * Template Analysis Types - RAGbox.co FORGE System
 */

export interface TemplateField {
  name: string
  type: 'text' | 'date' | 'number' | 'list' | 'signature' | 'checkbox'
  required: boolean
  defaultValue?: string
  placeholder?: string
  description?: string
}

export interface TemplateSection {
  name: string
  order: number
  content: string
  fields: TemplateField[]
}

export interface TemplateAnalysis {
  templateId: string
  name: string
  category: string
  sections: TemplateSection[]
  fields: TemplateField[]
  structure: {
    pageCount: number
    hasHeader: boolean
    hasFooter: boolean
    hasSignatureBlock: boolean
    layout: 'standard' | 'legal' | 'financial' | 'medical'
  }
  confidence: number
}

export interface GeneratedDocument {
  id: string
  templateId: string
  format: 'docx' | 'pdf'
  fileName: string
  downloadUrl: string
  generatedAt: string
  fieldValues: Record<string, string>
}
