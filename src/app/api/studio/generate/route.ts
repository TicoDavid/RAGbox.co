/**
 * Sovereign Studio - Generate Artifact API
 *
 * POST /api/studio/generate
 *
 * Generates documents, audio, presentations, and other artifacts
 * from vault documents using AI.
 *
 * Accepts both JSON and FormData (Jordan's frontend sends FormData
 * with optional template file attachments).
 *
 * STORY-235
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { generateArtifact } from '@/lib/studio/generator'
import { storageClient } from '@/lib/gcp/storage-client'
import type { GenerationRequest } from '@/lib/studio/types'
import { z } from 'zod'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 120 // Allow up to 2 minutes for complex artifacts

const ARTIFACT_TYPES = ['audio', 'video', 'mindmap', 'report', 'compliance', 'infographic', 'deck', 'evidence'] as const
const TONE_TYPES = ['standard', 'executive', 'forensic'] as const

// JSON request validation schema
const GenerationRequestSchema = z.object({
  artifactType: z.enum(ARTIFACT_TYPES),
  sourceDocumentIds: z.array(z.string()).min(1, 'At least one document required'),
  brandConfig: z.object({
    wordTemplateUrl: z.string().optional(),
    slideTemplateUrl: z.string().optional(),
    tone: z.enum(TONE_TYPES).default('standard'),
    companyName: z.string().optional(),
  }),
  title: z.string().optional(),
  additionalInstructions: z.string().optional(),
})

/**
 * Upload a template file (Word/Slide) to GCS and return its URL.
 */
async function uploadTemplateFile(file: File, userId: string, type: string): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const dest = `users/${userId}/templates/${Date.now()}-${type}-${file.name}`
  const result = await storageClient.uploadFile(buffer, dest, file.type, userId)
  return storageClient.getSignedUrl(result.gcsUri, 60 * 24)
}

/**
 * Parse a GenerationRequest from either JSON body or FormData.
 * FormData fields: artifactType, sourceDocumentIds (JSON string), tone,
 * wordTemplate (File), slideTemplate (File).
 */
async function parseRequest(request: NextRequest, userId: string): Promise<GenerationRequest> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await request.json()
    const validation = GenerationRequestSchema.safeParse(body)
    if (!validation.success) {
      const msg = validation.error.issues.map(i => i.message).join('; ')
      throw new Error(`Invalid request: ${msg}`)
    }
    return validation.data
  }

  // FormData (Jordan's frontend sends multipart/form-data with optional template files)
  const form = await request.formData()

  const artifactType = form.get('artifactType') as string
  if (!artifactType || !(ARTIFACT_TYPES as readonly string[]).includes(artifactType)) {
    throw new Error(`Invalid artifactType: ${artifactType}`)
  }

  const rawDocIds = form.get('sourceDocumentIds') as string
  let sourceDocumentIds: string[]
  try {
    sourceDocumentIds = JSON.parse(rawDocIds)
    if (!Array.isArray(sourceDocumentIds) || sourceDocumentIds.length === 0) {
      throw new Error('empty')
    }
  } catch {
    throw new Error('sourceDocumentIds must be a JSON array with at least one ID')
  }

  const tone = (form.get('tone') as string) || 'standard'
  if (!(TONE_TYPES as readonly string[]).includes(tone)) {
    throw new Error(`Invalid tone: ${tone}`)
  }

  // Upload template files to GCS if attached
  let wordTemplateUrl: string | undefined
  let slideTemplateUrl: string | undefined

  const wordFile = form.get('wordTemplate')
  if (wordFile instanceof File && wordFile.size > 0) {
    wordTemplateUrl = await uploadTemplateFile(wordFile, userId, 'word')
  }

  const slideFile = form.get('slideTemplate')
  if (slideFile instanceof File && slideFile.size > 0) {
    slideTemplateUrl = await uploadTemplateFile(slideFile, userId, 'slide')
  }

  return {
    artifactType: artifactType as GenerationRequest['artifactType'],
    sourceDocumentIds,
    brandConfig: {
      tone: tone as GenerationRequest['brandConfig']['tone'],
      ...(wordTemplateUrl ? { wordTemplateUrl } : {}),
      ...(slideTemplateUrl ? { slideTemplateUrl } : {}),
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate via NextAuth JWT
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    const userId = (token.id as string) || token.email || ''
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unable to determine user identity' },
        { status: 401 }
      )
    }

    // 2. Parse request (supports JSON or FormData)
    const generationRequest = await parseRequest(request, userId)

    // 3. Generate artifact
    const result = await generateArtifact(generationRequest, userId)

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const isUserError = message.includes('No accessible documents') ||
                        message.includes('At least one document') ||
                        message.includes('Invalid request') ||
                        message.includes('Invalid artifactType') ||
                        message.includes('sourceDocumentIds')

    logger.error('[Studio/Generate] Error:', error)
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
