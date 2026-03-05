/**
 * Voice Cloning API — FINAL WAVE Task 11
 *
 * POST /api/voice/clone
 *
 * Accepts audio samples and creates a custom voice via Inworld's voice cloning API.
 * Stores the custom voice ID in MercuryPersona.voiceId.
 *
 * Requires:
 * - INWORLD_API_KEY (or INWORLD_STUDIO_API_KEY)
 * - Audio samples (at least 1 minute of clear speech)
 *
 * If the Inworld voice cloning API is not available, returns instructions
 * for the manual process (upload via Inworld console).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

const INWORLD_API_KEY = process.env.INWORLD_API_KEY || process.env.INWORLD_STUDIO_API_KEY || ''
const INWORLD_API_URL = process.env.INWORLD_API_URL || 'https://studio.inworld.ai/v1'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unable to determine user identity' }, { status: 401 })
  }

  // Check if Inworld API key is configured
  if (!INWORLD_API_KEY) {
    return NextResponse.json({
      success: false,
      error: 'Voice cloning not configured',
      manual: {
        instructions: [
          '1. Go to https://studio.inworld.ai/workspaces',
          '2. Navigate to your workspace → Custom Voices',
          '3. Click "Create Custom Voice"',
          '4. Upload 1-5 minutes of clear speech audio samples',
          '5. Wait for processing (usually 5-10 minutes)',
          '6. Copy the voice ID from the voice settings',
          '7. Paste the voice ID into Mercury Settings → Voice → Custom Voice ID',
        ],
      },
    }, { status: 501 })
  }

  // Parse multipart form with audio samples
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Expected multipart form data with audio samples' },
      { status: 400 }
    )
  }

  const voiceName = formData.get('name') as string | null
  const audioFiles = formData.getAll('samples') as File[]

  if (!audioFiles.length) {
    return NextResponse.json(
      { success: false, error: 'At least one audio sample is required' },
      { status: 400 }
    )
  }

  // Validate audio files
  const maxSampleSize = 25 * 1024 * 1024 // 25MB per sample
  for (const sample of audioFiles) {
    if (sample.size > maxSampleSize) {
      return NextResponse.json(
        { success: false, error: `Audio sample "${sample.name}" exceeds 25MB limit` },
        { status: 413 }
      )
    }
  }

  try {
    // Attempt voice creation via Inworld API
    const voiceId = await createInworldVoice(
      voiceName || 'Custom Voice',
      audioFiles,
    )

    if (!voiceId) {
      return NextResponse.json({
        success: false,
        error: 'Voice cloning API returned no voice ID. The API tier may not support programmatic cloning.',
        manual: {
          instructions: [
            '1. Go to https://studio.inworld.ai/workspaces',
            '2. Upload your audio samples manually',
            '3. Copy the voice ID and enter it in Mercury Settings',
          ],
        },
      }, { status: 502 })
    }

    // Store voice ID in MercuryPersona
    await prisma.$executeRawUnsafe(
      `UPDATE mercury_personas
       SET voice_id = $1, updated_at = NOW()
       WHERE tenant_id = $2`,
      voiceId, userId,
    )

    logger.info('[VoiceClone] Custom voice created', { userId, voiceId, voiceName })

    return NextResponse.json({
      success: true,
      data: {
        voiceId,
        voiceName: voiceName || 'Custom Voice',
        status: 'ready',
      },
    })
  } catch (err) {
    logger.error('[VoiceClone] Voice creation failed:', err)
    return NextResponse.json(
      { success: false, error: 'Voice cloning failed. Check Inworld API configuration.' },
      { status: 500 }
    )
  }
}

/**
 * List available voices including custom ones.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''

  // Get the user's current persona voice
  const persona = await prisma.$queryRawUnsafe<Array<{ voice_id: string | null }>>(
    `SELECT voice_id FROM mercury_personas WHERE tenant_id = $1 LIMIT 1`,
    userId,
  )

  const currentVoiceId = persona[0]?.voice_id || null

  // Standard Inworld voices
  const standardVoices = [
    { id: 'en-US-Neural2-F', name: 'Female - Professional', type: 'standard' },
    { id: 'en-US-Neural2-D', name: 'Male - Professional', type: 'standard' },
    { id: 'en-US-Neural2-C', name: 'Female - Warm', type: 'standard' },
    { id: 'en-US-Neural2-A', name: 'Male - Warm', type: 'standard' },
    { id: 'en-US-Neural2-E', name: 'Female - Authoritative', type: 'standard' },
    { id: 'en-US-Neural2-J', name: 'Male - Authoritative', type: 'standard' },
  ]

  // If the current voice ID doesn't match any standard voice, it's custom
  const voices = [...standardVoices]
  if (currentVoiceId && !standardVoices.some(v => v.id === currentVoiceId)) {
    voices.unshift({
      id: currentVoiceId,
      name: 'Custom Voice',
      type: 'custom',
    })
  }

  return NextResponse.json({
    success: true,
    data: {
      voices,
      currentVoiceId,
      cloningAvailable: !!INWORLD_API_KEY,
    },
  })
}

/**
 * Create a custom voice via Inworld Studio API.
 * Returns the voice ID or null if the API doesn't support programmatic cloning.
 */
async function createInworldVoice(
  name: string,
  samples: File[],
): Promise<string | null> {
  // Build multipart form for Inworld API
  const form = new FormData()
  form.append('displayName', name)

  for (const sample of samples) {
    form.append('audioSamples', sample, sample.name)
  }

  const res = await fetch(`${INWORLD_API_URL}/voices`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${INWORLD_API_KEY}`,
    },
    body: form,
  })

  if (!res.ok) {
    const errText = await res.text()
    logger.error('[VoiceClone] Inworld API error:', res.status, errText)

    // 404 or 501 means this API endpoint doesn't exist in current tier
    if (res.status === 404 || res.status === 501) {
      return null
    }

    throw new Error(`Inworld voice API error: ${res.status}`)
  }

  const data = await res.json() as { name?: string; voiceId?: string; id?: string }
  return data.voiceId || data.id || data.name || null
}
