/**
 * Template Analysis via Vertex AI - RAGbox.co FORGE System
 *
 * Analyzes uploaded templates to extract structure, fields, and layout.
 * Uses Gemini for document understanding.
 */

import { ragClient } from '@/lib/vertex/rag-client'
import type { TemplateAnalysis, TemplateField, TemplateSection } from '@/types/templateAnalysis'

/**
 * Analyze a template document to extract its structure
 */
export async function analyzeTemplate(
  text: string,
  filename: string
): Promise<TemplateAnalysis> {
  const prompt = `Analyze this document template and extract its structure. Return a JSON object with:
1. "name": template name
2. "category": one of "legal", "financial", "medical", "general"
3. "sections": array of {name, order, content_summary}
4. "fields": array of fillable fields {name, type, required, placeholder, description}
   - type must be one of: "text", "date", "number", "list", "signature", "checkbox"
5. "structure": {pageCount, hasHeader, hasFooter, hasSignatureBlock, layout}
6. "confidence": 0-1 score for analysis quality

Document content:
${text.substring(0, 5000)}

Return ONLY valid JSON, no markdown.`

  try {
    const response = await ragClient.chat(prompt, {
      systemPrompt: 'You are a document template analyzer. Return only valid JSON.',
    })

    const parsed = JSON.parse(response.answer.replace(/```json\n?|\n?```/g, '').trim())

    const fields: TemplateField[] = (parsed.fields || []).map((f: Record<string, unknown>) => ({
      name: String(f.name || ''),
      type: ['text', 'date', 'number', 'list', 'signature', 'checkbox'].includes(String(f.type))
        ? String(f.type) as TemplateField['type']
        : 'text',
      required: Boolean(f.required),
      defaultValue: f.defaultValue ? String(f.defaultValue) : undefined,
      placeholder: f.placeholder ? String(f.placeholder) : undefined,
      description: f.description ? String(f.description) : undefined,
    }))

    const sections: TemplateSection[] = (parsed.sections || []).map((s: Record<string, unknown>, i: number) => ({
      name: String(s.name || `Section ${i + 1}`),
      order: Number(s.order) || i,
      content: String(s.content_summary || s.content || ''),
      fields: [],
    }))

    return {
      templateId: `tmpl_${Date.now()}`,
      name: parsed.name || filename.replace(/\.\w+$/, ''),
      category: parsed.category || 'general',
      sections,
      fields,
      structure: {
        pageCount: parsed.structure?.pageCount || 1,
        hasHeader: Boolean(parsed.structure?.hasHeader),
        hasFooter: Boolean(parsed.structure?.hasFooter),
        hasSignatureBlock: Boolean(parsed.structure?.hasSignatureBlock),
        layout: parsed.structure?.layout || 'standard',
      },
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
    }
  } catch (error) {
    console.error('[FORGE] Template analysis failed:', error)

    // Return a basic analysis on failure
    return {
      templateId: `tmpl_${Date.now()}`,
      name: filename.replace(/\.\w+$/, ''),
      category: 'general',
      sections: [{ name: 'Main', order: 0, content: text.substring(0, 500), fields: [] }],
      fields: [],
      structure: {
        pageCount: 1,
        hasHeader: false,
        hasFooter: false,
        hasSignatureBlock: false,
        layout: 'standard',
      },
      confidence: 0.3,
    }
  }
}
