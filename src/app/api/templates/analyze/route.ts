import { NextRequest, NextResponse } from 'next/server'
import { analyzeTemplate } from '@/lib/forge/deepseekOcr'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/templates/analyze - Upload and analyze a template document
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Extract text from file
    const text = await file.text()
    if (!text.trim()) {
      return NextResponse.json({ error: 'File appears to be empty' }, { status: 400 })
    }

    // Analyze with AI
    const analysis = await analyzeTemplate(text, file.name)

    // Save to database
    const template = await prisma.template.create({
      data: {
        id: analysis.templateId,
        name: analysis.name,
        category: analysis.category,
        sections: JSON.parse(JSON.stringify(analysis.sections)),
        fields: JSON.parse(JSON.stringify(analysis.fields)),
        structure: JSON.parse(JSON.stringify(analysis.structure)),
        confidence: analysis.confidence,
      },
    })

    return NextResponse.json({
      templateId: template.id,
      name: analysis.name,
      category: analysis.category,
      fieldsCount: analysis.fields.length,
      sectionsCount: analysis.sections.length,
      confidence: analysis.confidence,
    })
  } catch (error) {
    console.error('[FORGE] Template analysis failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Template analysis failed' },
      { status: 500 }
    )
  }
}
