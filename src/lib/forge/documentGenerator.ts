/**
 * Document Generator - RAGbox.co FORGE System
 *
 * Generates documents from templates with filled field values.
 */

import { ragClient } from '@/lib/vertex/rag-client'
import type { TemplateField } from '@/types/templateAnalysis'

export interface GenerationInput {
  templateName: string
  category: string
  fields: TemplateField[]
  fieldValues: Record<string, string>
  sourceContext?: string
}

export interface GenerationResult {
  content: string
  format: 'text' | 'html'
  fileName: string
}

/**
 * Generate a document from a template with filled values
 */
export async function generateDocument(input: GenerationInput): Promise<GenerationResult> {
  const fieldsSummary = input.fields
    .map(f => `- ${f.name} (${f.type}${f.required ? ', required' : ''}): ${input.fieldValues[f.name] || f.defaultValue || '[not provided]'}`)
    .join('\n')

  const prompt = `Generate a professional ${input.category} document based on this template.

Template: ${input.templateName}
Category: ${input.category}

Field values:
${fieldsSummary}

${input.sourceContext ? `\nContext from RAG query:\n${input.sourceContext}\n` : ''}

Generate the complete document content in well-formatted text. Include all sections, headers, and formatted content appropriate for a ${input.category} document. Use the provided field values where applicable.`

  const response = await ragClient.chat(prompt, {
    systemPrompt: `You are a professional document generator specializing in ${input.category} documents. Generate well-structured, complete documents.`,
  })

  const fileName = `${input.templateName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`

  return {
    content: response.answer,
    format: 'text',
    fileName,
  }
}
