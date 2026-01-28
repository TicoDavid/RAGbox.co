import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/templates - List templates or get one by ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      const template = await prisma.template.findUnique({ where: { id } })
      if (!template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }
      return NextResponse.json({
        template: {
          templateId: template.id,
          name: template.name,
          category: template.category,
          sections: template.sections,
          fields: template.fields,
          structure: template.structure,
          confidence: template.confidence,
        },
      })
    }

    const templates = await prisma.template.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      templates: templates.map((t) => ({
        templateId: t.id,
        name: t.name,
        category: t.category,
        sections: t.sections,
        fields: t.fields,
        structure: t.structure,
        confidence: t.confidence,
      })),
    })
  } catch (error) {
    console.error('[FORGE] Failed to fetch templates:', error)
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

/**
 * POST /api/templates - Create a template from analysis result
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, category, sections, fields, structure, confidence } = body

    if (!name) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 })
    }

    const template = await prisma.template.create({
      data: {
        name,
        category: category || 'general',
        sections: sections || [],
        fields: fields || [],
        structure: structure || {},
        confidence: confidence ?? 0.5,
      },
    })

    return NextResponse.json({
      templateId: template.id,
      name: template.name,
    })
  } catch (error) {
    console.error('[FORGE] Failed to create template:', error)
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
  }
}

/**
 * DELETE /api/templates?id=xxx - Delete a template
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
    }

    await prisma.template.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[FORGE] Failed to delete template:', error)
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
  }
}
