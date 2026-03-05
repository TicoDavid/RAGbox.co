/**
 * Mercury Persona API
 *
 * GET  /api/persona — Get current tenant's persona
 * PUT  /api/persona — Update persona settings
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { authorizeAgentAccessJWT } from '@/lib/agent/authorization'

const DEFAULT_TENANT = 'default'

const PERSONALITY_PRESETS: Record<string, string> = {
  professional:
    'You are precise, citation-focused, and formal. You never speculate. Every answer must be grounded in the documents provided.',
  friendly:
    'You are warm, conversational, and helpful. You explain things simply and always cite your sources. You make complex documents accessible.',
  technical:
    'You are detailed, thorough, and use precise terminology. You provide deep analysis with full citations and cross-references between documents.',
}

const ROLE_PRESETS: Record<string, string> = {
  ceo: 'You are briefing a Chief Executive Officer. Prioritize board-level impact, strategic alignment, competitive positioning, and enterprise risk.',
  cfo: 'You are briefing a Chief Financial Officer. Prioritize financial metrics, contractual obligations, monetary exposure, and risk quantification.',
  cmo: 'You are briefing a Chief Marketing Officer. Focus on brand positioning, market intelligence, competitive landscape, and growth opportunities.',
  coo: 'You are briefing a Chief Operating Officer. Focus on operational efficiency, process compliance, resource allocation, SLA adherence, and execution timelines.',
  cpo: 'You are briefing a Chief Product Officer. Focus on product strategy, feature requirements, user impact, technical debt, and competitive differentiation.',
  cto: 'You are briefing a Chief Technology Officer. Focus on technical architecture, system dependencies, security posture, scalability, and integration complexity.',
  legal: 'You are briefing a legal professional. Prioritize precise language, contractual terms, regulatory references, dates, parties, and obligations.',
  compliance: 'You are a compliance officer reviewing for regulatory adherence. Focus on policy violations, control gaps, reporting obligations, and remediation requirements.',
  auditor: 'You are an internal auditor examining documents for control effectiveness, material weaknesses, and risk exposure.',
  whistleblower: 'You are a forensic investigator examining documents for anomalies, irregularities, and potential misconduct.',
}

/**
 * Combine personality preset + role preset + custom instructions into a single prompt.
 * This resolved text is stored in personalityPrompt for the Go backend.
 */
function buildCombinedPrompt(
  personalityPreset?: string,
  rolePreset?: string,
  customInstructions?: string,
): string {
  const parts: string[] = []
  if (personalityPreset && PERSONALITY_PRESETS[personalityPreset]) {
    parts.push(PERSONALITY_PRESETS[personalityPreset])
  }
  if (rolePreset && ROLE_PRESETS[rolePreset]) {
    parts.push(ROLE_PRESETS[rolePreset])
  }
  if (customInstructions?.trim()) {
    parts.push(customInstructions.trim())
  }
  return parts.length > 0 ? parts.join('\n\n') : PERSONALITY_PRESETS.professional
}

async function getAuth(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
  if (!token) return null
  const userId = (token.id as string) || token.email || ''
  return { userId, tenantId: userId }
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
        firstName: 'Mercury',
        lastName: '',
        title: 'AI Assistant',
        personalityPreset: 'professional',
        personalityPrompt: PERSONALITY_PRESETS.professional,
        greeting: 'Welcome to RAGbox. Upload documents to your vault and ask me anything about them.',
      },
    })
  }

  return NextResponse.json({ success: true, data: { persona, presets: PERSONALITY_PRESETS, rolePresets: ROLE_PRESETS } })
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const auth = await getAuth(request)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  // Verify the persona exists and belongs to user's tenant
  const existingPersona = await prisma.mercuryPersona.findUnique({
    where: { tenantId: auth.tenantId },
    select: { id: true },
  })
  if (existingPersona) {
    const agentAuth = await authorizeAgentAccessJWT(request, existingPersona.id)
    if (!agentAuth.authorized) {
      return NextResponse.json({ success: false, error: agentAuth.error }, { status: agentAuth.status })
    }
  }

  let body: {
    firstName?: string
    lastName?: string
    title?: string
    personalityPrompt?: string
    personalityPreset?: string
    rolePreset?: string
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

  // Build combined prompt from presets + custom instructions
  // personalityPrompt field stores custom instructions when presets are used
  const resolvedPrompt = buildCombinedPrompt(
    body.personalityPreset,
    body.rolePreset,
    body.personalityPrompt,
  )

  const updateData: Record<string, unknown> = {}
  if (body.firstName !== undefined) updateData.firstName = body.firstName.trim()
  if (body.lastName !== undefined) updateData.lastName = body.lastName.trim()
  if (body.title !== undefined) updateData.title = body.title.trim()
  if (body.personalityPreset !== undefined) updateData.personalityPreset = body.personalityPreset || null
  if (body.rolePreset !== undefined) updateData.rolePreset = body.rolePreset || null
  updateData.personalityPrompt = resolvedPrompt
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
      firstName: (body.firstName || 'Mercury').trim(),
      lastName: (body.lastName || '').trim(),
      title: body.title || 'AI Assistant',
      personalityPreset: body.personalityPreset || 'professional',
      rolePreset: body.rolePreset || null,
      personalityPrompt: resolvedPrompt,
      voiceId: body.voiceId,
      greeting: body.greeting || 'Welcome to RAGbox. Upload documents and ask me anything.',
      signatureBlock: body.signatureBlock,
      silenceHighThreshold: body.silenceHighThreshold ?? 0.85,
      silenceMedThreshold: body.silenceMedThreshold ?? 0.70,
    },
  })

  return NextResponse.json({ success: true, data: { persona } })
}
