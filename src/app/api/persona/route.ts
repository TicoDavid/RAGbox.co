/**
 * Mercury Persona API
 *
 * GET  /api/persona — Get current tenant's persona
 * PUT  /api/persona — Update persona settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

const DEFAULT_TENANT = 'default'

const PERSONALITY_PRESETS: Record<string, string> = {
  professional:
    'You are precise, citation-focused, and formal. You never speculate. Every answer must be grounded in the documents provided.',
  friendly:
    'You are warm, conversational, and helpful. You explain things simply and always cite your sources. You make complex documents accessible.',
  technical:
    'You are detailed, thorough, and use precise terminology. You provide deep analysis with full citations and cross-references between documents.',
}

async function getAuth(request: NextRequest) {
  const token = await getToken({ req: request })
  if (!token) return null
  return { userId: (token.id as string) || token.email || '', tenantId: DEFAULT_TENANT }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await getAuth(request)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  let persona = await prisma.mercuryPersona.findUnique({
    where: { tenantId: auth.tenantId },
  })

  // Auto-create default persona if none exists
  if (!persona) {
    persona = await prisma.mercuryPersona.create({
      data: {
        tenantId: auth.tenantId,
        firstName: 'M.E.R.C.U.R.Y.',
        lastName: '',
        title: 'AI Assistant',
        personalityPrompt: PERSONALITY_PRESETS.professional,
        greeting: 'Welcome to RAGbox. Upload documents to your vault and ask me anything about them.',
      },
    })
  }

  return NextResponse.json({ success: true, data: { persona, presets: PERSONALITY_PRESETS } })
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const auth = await getAuth(request)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  let body: {
    firstName?: string
    lastName?: string
    title?: string
    personalityPrompt?: string
    personalityPreset?: string
    voiceId?: string
    greeting?: string
    signatureBlock?: string
    silenceHighThreshold?: number
    silenceMedThreshold?: number
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.firstName !== undefined && (!body.firstName || !body.firstName.trim())) {
    return NextResponse.json({ success: false, error: 'First name is required' }, { status: 400 })
  }

  // Resolve personality from preset if provided
  let personalityPrompt = body.personalityPrompt
  if (body.personalityPreset && PERSONALITY_PRESETS[body.personalityPreset]) {
    personalityPrompt = PERSONALITY_PRESETS[body.personalityPreset]
  }

  const updateData: Record<string, unknown> = {}
  if (body.firstName !== undefined) updateData.firstName = body.firstName.trim()
  if (body.lastName !== undefined) updateData.lastName = body.lastName.trim()
  if (body.title !== undefined) updateData.title = body.title.trim()
  if (personalityPrompt !== undefined) updateData.personalityPrompt = personalityPrompt
  if (body.voiceId !== undefined) updateData.voiceId = body.voiceId
  if (body.greeting !== undefined) updateData.greeting = body.greeting
  if (body.signatureBlock !== undefined) updateData.signatureBlock = body.signatureBlock
  if (body.silenceHighThreshold !== undefined) updateData.silenceHighThreshold = body.silenceHighThreshold
  if (body.silenceMedThreshold !== undefined) updateData.silenceMedThreshold = body.silenceMedThreshold

  const persona = await prisma.mercuryPersona.upsert({
    where: { tenantId: auth.tenantId },
    update: updateData,
    create: {
      tenantId: auth.tenantId,
      firstName: (body.firstName || 'M.E.R.C.U.R.Y.').trim(),
      lastName: (body.lastName || '').trim(),
      title: body.title || 'AI Assistant',
      personalityPrompt: personalityPrompt || PERSONALITY_PRESETS.professional,
      voiceId: body.voiceId,
      greeting: body.greeting || 'Welcome to RAGbox. Upload documents and ask me anything.',
      signatureBlock: body.signatureBlock,
      silenceHighThreshold: body.silenceHighThreshold ?? 0.85,
      silenceMedThreshold: body.silenceMedThreshold ?? 0.70,
    },
  })

  return NextResponse.json({ success: true, data: { persona } })
}
