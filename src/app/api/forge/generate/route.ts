import { NextRequest, NextResponse } from 'next/server'
import { generateDocument } from '@/lib/forge/documentGenerator'
import type { TemplateField } from '@/types/templateAnalysis'

/**
 * POST /api/forge/generate - Generate a document from a template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { templateName, category, fields, fieldValues, sourceContext } = body

    if (!templateName || !fields || !fieldValues) {
      return NextResponse.json(
        { error: 'templateName, fields, and fieldValues are required' },
        { status: 400 }
      )
    }

    const typedFields: TemplateField[] = (fields as Record<string, unknown>[]).map(
      (f: Record<string, unknown>) => ({
        name: String(f.name || ''),
        type: (f.type as TemplateField['type']) || 'text',
        required: Boolean(f.required),
        defaultValue: f.defaultValue ? String(f.defaultValue) : undefined,
        placeholder: f.placeholder ? String(f.placeholder) : undefined,
        description: f.description ? String(f.description) : undefined,
      })
    )

    // Check required fields
    const missingRequired = typedFields
      .filter(f => f.required && !fieldValues[f.name]?.trim())
      .map(f => f.name)

    if (missingRequired.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missingRequired.join(', ')}` },
        { status: 400 }
      )
    }

    const result = await generateDocument({
      templateName,
      category: category || 'general',
      fields: typedFields,
      fieldValues,
      sourceContext,
    })

    // Return content as a data URL for download
    const base64 = Buffer.from(result.content, 'utf-8').toString('base64')
    const downloadUrl = `data:text/plain;base64,${base64}`

    return NextResponse.json({
      content: result.content,
      format: result.format,
      fileName: result.fileName,
      downloadUrl,
    })
  } catch (error) {
    console.error('[FORGE] Document generation failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Document generation failed' },
      { status: 500 }
    )
  }
}
