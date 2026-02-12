/**
 * Sovereign Studio - Generate Artifact API
 *
 * POST /api/studio/generate
 *
 * Generates documents, audio, presentations, and other artifacts
 * from vault documents using AI.
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { generateArtifact } from '@/lib/studio/generator'
import type { GenerationRequest } from '@/lib/studio/types'
import { z } from 'zod'

/**
 * Extract user ID from request (matches documents route pattern)
 */
async function getUserId(request: NextRequest): Promise<string | null> {
  const sessionCookie = (await cookies()).get('session')
  if (sessionCookie?.value) {
    return sessionCookie.value
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}

export const runtime = 'nodejs'
export const maxDuration = 120 // Allow up to 2 minutes for complex artifacts

// Request validation schema
const GenerationRequestSchema = z.object({
  artifactType: z.enum(['audio', 'video', 'mindmap', 'report', 'compliance', 'infographic', 'deck', 'evidence']),
  sourceDocumentIds: z.array(z.string()).min(1, 'At least one document required'),
  brandConfig: z.object({
    wordTemplateUrl: z.string().optional(),
    slideTemplateUrl: z.string().optional(),
    tone: z.enum(['standard', 'executive', 'forensic']).default('standard'),
    companyName: z.string().optional(),
  }),
  title: z.string().optional(),
  additionalInstructions: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate (using same pattern as documents route)
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Parse and validate request
    const body = await request.json()
    const validation = GenerationRequestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: validation.error.issues,
        },
        { status: 400 }
      )
    }

    const generationRequest: GenerationRequest = validation.data

    // 3. Generate artifact
    const result = await generateArtifact(generationRequest, userId)

    // 5. Return success response
    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isUserError = message.includes('No accessible documents') ||
                        message.includes('At least one document')

    return NextResponse.json(
      {
        success: false,
        error: isUserError ? message : 'Artifact generation failed',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
      },
      { status: isUserError ? 400 : 500 }
    )
  }
}

/**
 * GET /api/studio/generate
 *
 * Returns available artifact types and their descriptions
 */
export async function GET() {
  const artifactTypes = [
    {
      type: 'audio',
      label: 'Audio Overview',
      description: 'Deep Dive Podcast - narrated summary of your documents',
      outputFormat: 'MP3',
      estimatedTime: '30-60 seconds',
    },
    {
      type: 'video',
      label: 'Video Briefing',
      description: 'Script with visual cues for dynamic briefing video',
      outputFormat: 'JSON (script)',
      estimatedTime: '20-40 seconds',
    },
    {
      type: 'mindmap',
      label: 'Mind Map',
      description: 'Visual knowledge graph of document concepts',
      outputFormat: 'JSON + Mermaid',
      estimatedTime: '10-20 seconds',
    },
    {
      type: 'report',
      label: 'Forensic Report',
      description: 'Comprehensive analysis document with findings',
      outputFormat: 'Markdown',
      estimatedTime: '20-40 seconds',
    },
    {
      type: 'compliance',
      label: 'Compliance Drill',
      description: 'Flashcards and quiz for training',
      outputFormat: 'JSON',
      estimatedTime: '15-30 seconds',
    },
    {
      type: 'infographic',
      label: 'Infographic',
      description: 'Key stats and data points for visual summary',
      outputFormat: 'JSON',
      estimatedTime: '10-20 seconds',
    },
    {
      type: 'deck',
      label: 'Board Deck',
      description: 'Executive presentation slides',
      outputFormat: 'JSON (PPTX-ready)',
      estimatedTime: '20-40 seconds',
    },
    {
      type: 'evidence',
      label: 'Evidence Log',
      description: 'Systematic evidence extraction spreadsheet',
      outputFormat: 'CSV',
      estimatedTime: '15-30 seconds',
    },
  ]

  const tones = [
    {
      type: 'standard',
      label: 'Standard Professional',
      description: 'Clear, balanced business communication',
    },
    {
      type: 'executive',
      label: 'Executive Brief',
      description: 'Terse, high-impact C-suite style',
    },
    {
      type: 'forensic',
      label: 'Forensic Audit',
      description: 'Critical, investigative tone highlighting risks',
    },
  ]

  return NextResponse.json({
    success: true,
    data: {
      artifactTypes,
      tones,
    },
  })
}
