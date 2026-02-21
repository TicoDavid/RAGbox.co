/**
 * Mercury Config API
 *
 * GET  /api/mercury/config — Load current agent configuration
 * POST /api/mercury/config — Save agent configuration
 *
 * Maps to MercuryPersona table. Shapes the response to match the
 * MercuryConfigModal's expected JSON contract.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

const DEFAULT_TENANT = 'default'

const PERSONALITY_PRESETS: Record<string, string> = {
  // Core presets
  professional:
    'You are precise, citation-focused, and formal. You never speculate. Every answer must be grounded in the documents provided.',
  friendly:
    'You are warm, conversational, and helpful. You explain things simply and always cite your sources. You make complex documents accessible.',
  technical:
    'You are detailed, thorough, and use precise terminology. You provide deep analysis with full citations and cross-references between documents.',
  // C-Suite personas
  ceo:
    'You are briefing a Chief Executive Officer. Prioritize board-level impact, strategic alignment, competitive positioning, and enterprise risk. Synthesize across documents to surface the executive narrative.',
  cfo:
    'You are briefing a Chief Financial Officer. Prioritize financial metrics, contractual obligations, monetary exposure, and risk quantification. Lead with numbers. Present financial figures in summary tables first.',
  cmo:
    'You are briefing a Chief Marketing Officer. Focus on brand positioning, market intelligence, competitive landscape, and growth opportunities. Frame findings in terms of market impact and audience reach.',
  coo:
    'You are briefing a Chief Operating Officer. Focus on operational efficiency, process compliance, resource allocation, SLA adherence, and execution timelines. Flag operational risks and bottlenecks.',
  cpo:
    'You are briefing a Chief Product Officer. Focus on product strategy, feature requirements, user impact, technical debt, and competitive differentiation. Frame findings around product-market fit.',
  cto:
    'You are briefing a Chief Technology Officer. Focus on technical architecture, system dependencies, security posture, scalability, and integration complexity. Provide precise technical analysis.',
  // Specialist personas
  legal:
    'You are briefing a legal professional. Prioritize precise language, contractual terms, regulatory references, dates, parties, and obligations. Flag ambiguities explicitly. Never paraphrase when exact wording matters.',
  compliance:
    'You are a compliance officer reviewing for regulatory adherence. Focus on policy violations, control gaps, reporting obligations, and remediation requirements. Reference specific regulations and standards.',
  auditor:
    'You are an internal auditor examining documents for control effectiveness, material weaknesses, and risk exposure. Test every claim against supporting evidence. Trust nothing at face value.',
  whistleblower:
    'You are a forensic investigator examining documents for anomalies, irregularities, and potential misconduct. Flag discrepancies, unusual patterns, timeline inconsistencies, and missing documentation.',
}

interface MercuryConfigPayload {
  name: string
  title: string
  greeting: string
  personalityPrompt: string
  voiceGender: 'male' | 'female'
  silenceThreshold: number
  channels: {
    email: { enabled: boolean; address?: string }
    whatsapp: { enabled: boolean }
    voice: { enabled: boolean; voiceId?: string }
  }
}

async function getAuth(request: NextRequest) {
  const token = await getToken({ req: request })
  if (!token) return null
  return { userId: (token.id as string) || token.email || '', tenantId: DEFAULT_TENANT }
}

/**
 * Map MercuryPersona DB record to the config modal's JSON shape.
 */
function toConfigPayload(persona: {
  firstName: string
  lastName: string
  title: string | null
  greeting: string | null
  personalityPrompt: string
  voiceId: string | null
  silenceHighThreshold: number
  channelConfig: unknown
  emailEnabled: boolean
  emailAddress: string | null
}): MercuryConfigPayload {
  const channels = (typeof persona.channelConfig === 'object' && persona.channelConfig !== null
    ? persona.channelConfig
    : {}) as Record<string, unknown>

  const voiceChannel = channels.voice as { enabled?: boolean; voiceId?: string } | undefined

  return {
    name: [persona.firstName, persona.lastName].filter(Boolean).join(' '),
    title: persona.title || 'AI Assistant',
    greeting: persona.greeting || '',
    personalityPrompt: persona.personalityPrompt,
    voiceGender: inferGender(persona.voiceId),
    silenceThreshold: persona.silenceHighThreshold,
    channels: {
      email: {
        enabled: persona.emailEnabled,
        address: persona.emailAddress || undefined,
      },
      whatsapp: {
        enabled: (channels.whatsapp as { enabled?: boolean })?.enabled ?? false,
      },
      voice: {
        enabled: voiceChannel?.enabled ?? true,
        voiceId: persona.voiceId || undefined,
      },
    },
  }
}

function inferGender(voiceId: string | null): 'male' | 'female' {
  if (!voiceId) return 'female'
  const lower = voiceId.toLowerCase()
  const maleVoices = ['adam', 'josh', 'daniel', 'en-us-neural2-d', 'en-us-neural2-j']
  return maleVoices.some((v) => lower.includes(v)) ? 'male' : 'female'
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await getAuth(request)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  let persona = await prisma.mercuryPersona.findUnique({
    where: { tenantId: auth.tenantId },
  })

  if (!persona) {
    persona = await prisma.mercuryPersona.create({
      data: {
        tenantId: auth.tenantId,
        firstName: 'Mercury',
        lastName: '',
        title: 'AI Assistant',
        personalityPrompt: PERSONALITY_PRESETS.professional,
        greeting: 'Welcome to RAGbox. Upload documents to your vault and ask me anything about them.',
      },
    })
  }

  return NextResponse.json({
    success: true,
    data: {
      config: toConfigPayload(persona),
      presets: PERSONALITY_PRESETS,
    },
  })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await getAuth(request)
  if (!auth) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  let body: Partial<MercuryConfigPayload & { personalityPreset?: string }>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (body.name !== undefined && !body.name.trim()) {
    return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 })
  }

  if (body.silenceThreshold !== undefined) {
    if (body.silenceThreshold < 0.1 || body.silenceThreshold > 1.0) {
      return NextResponse.json(
        { success: false, error: 'Silence threshold must be between 0.1 and 1.0' },
        { status: 400 },
      )
    }
  }

  // Split name into first/last
  const nameParts = body.name?.trim().split(/\s+/) ?? []
  const firstName = nameParts[0]
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined

  // Resolve personality from preset if provided
  let personalityPrompt = body.personalityPrompt
  if (body.personalityPreset && PERSONALITY_PRESETS[body.personalityPreset]) {
    personalityPrompt = PERSONALITY_PRESETS[body.personalityPreset]
  }

  // Build channel config JSON
  const channelConfig = body.channels
    ? {
        whatsapp: { enabled: body.channels.whatsapp?.enabled ?? false },
        voice: {
          enabled: body.channels.voice?.enabled ?? true,
          voiceId: body.channels.voice?.voiceId,
        },
      }
    : undefined

  const updateData: Record<string, unknown> = {}
  if (firstName !== undefined) updateData.firstName = firstName
  if (lastName !== undefined) updateData.lastName = lastName
  if (body.title !== undefined) updateData.title = body.title.trim()
  if (personalityPrompt !== undefined) updateData.personalityPrompt = personalityPrompt
  if (body.greeting !== undefined) updateData.greeting = body.greeting
  if (body.silenceThreshold !== undefined) updateData.silenceHighThreshold = body.silenceThreshold
  if (body.voiceGender !== undefined) {
    updateData.voiceId = body.channels?.voice?.voiceId ?? (body.voiceGender === 'male' ? 'en-US-Neural2-D' : 'en-US-Neural2-F')
  }
  if (channelConfig !== undefined) updateData.channelConfig = channelConfig
  if (body.channels?.email !== undefined) {
    updateData.emailEnabled = body.channels.email.enabled
    if (body.channels.email.address !== undefined) {
      updateData.emailAddress = body.channels.email.address
    }
  }

  const persona = await prisma.mercuryPersona.upsert({
    where: { tenantId: auth.tenantId },
    update: updateData,
    create: {
      tenantId: auth.tenantId,
      firstName: firstName || 'Mercury',
      lastName: lastName || '',
      title: body.title || 'AI Assistant',
      personalityPrompt: personalityPrompt || PERSONALITY_PRESETS.professional,
      greeting: body.greeting || 'Welcome to RAGbox. Upload documents and ask me anything.',
      silenceHighThreshold: body.silenceThreshold ?? 0.60,
      channelConfig: channelConfig || {},
    },
  })

  return NextResponse.json({
    success: true,
    data: { config: toConfigPayload(persona) },
  })
}
