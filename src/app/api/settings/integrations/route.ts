/**
 * Integration Settings API - RAGbox.co
 *
 * GET  /api/settings/integrations — Return user's integration settings (credentials masked)
 * PUT  /api/settings/integrations — Update settings (partial update)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'

// Fields that contain sensitive credentials
const CREDENTIAL_FIELDS = [
  'vonageApiKey',
  'vonageApiSecret',
  'vonageApplicationId',
  'metaAccessToken',
  'metaPhoneNumberId',
  'metaAppSecret',
] as const

/** Mask a credential string — show only last 4 chars */
function maskCredential(value: string | null): string | null {
  if (!value) return null
  if (value.length <= 4) return '****'
  return '*'.repeat(value.length - 4) + value.slice(-4)
}

/** Check if a value is a masked placeholder (contains only * and last 4 chars) */
function isMaskedValue(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return /^\*+.{0,4}$/.test(value)
}

// =============================================================================
// GET — Return settings with masked credentials
// =============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    const userId = (token.id as string) || token.email || ''
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unable to determine user identity' },
        { status: 401 },
      )
    }

    let settings = await prisma.integrationSettings.findUnique({
      where: { userId },
    })

    // Create default settings if none exist
    if (!settings) {
      settings = await prisma.integrationSettings.create({
        data: { userId },
      })
    }

    // Mask credentials before sending to client
    const masked = {
      ...settings,
      vonageApiKey: maskCredential(settings.vonageApiKey),
      vonageApiSecret: maskCredential(settings.vonageApiSecret),
      vonageApplicationId: maskCredential(settings.vonageApplicationId),
      metaAccessToken: maskCredential(settings.metaAccessToken),
      metaPhoneNumberId: maskCredential(settings.metaPhoneNumberId),
      metaAppSecret: maskCredential(settings.metaAppSecret),
    }

    return NextResponse.json({ success: true, data: masked })
  } catch (error) {
    console.error('[API] Integration settings GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch integration settings' },
      { status: 500 },
    )
  }
}

// =============================================================================
// PUT — Update settings (partial update, reject masked values)
// =============================================================================

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    const userId = (token.id as string) || token.email || ''
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unable to determine user identity' },
        { status: 401 },
      )
    }

    const body = await request.json()

    // Strip masked credential values to prevent overwriting real creds
    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'whatsappEnabled',
      'whatsappProvider',
      'vonageApiKey',
      'vonageApiSecret',
      'vonageApplicationId',
      'vonageWhatsAppNumber',
      'metaAccessToken',
      'metaPhoneNumberId',
      'metaAppSecret',
      'mercuryVoiceEnabled',
      'mercuryVoiceModel',
      'mercuryAutoReply',
      'whatsappAllowInbound',
      'whatsappAllowOutbound',
      'whatsappAllowVoiceNotes',
      'whatsappAllowedNumbers',
      'defaultVaultId',
    ]

    for (const field of allowedFields) {
      if (field in body) {
        // Skip masked credential values
        if (
          CREDENTIAL_FIELDS.includes(field as typeof CREDENTIAL_FIELDS[number]) &&
          isMaskedValue(body[field])
        ) {
          continue
        }
        updateData[field] = body[field]
      }
    }

    const settings = await prisma.integrationSettings.upsert({
      where: { userId },
      update: updateData,
      create: { userId, ...updateData },
    })

    // Return masked version
    const masked = {
      ...settings,
      vonageApiKey: maskCredential(settings.vonageApiKey),
      vonageApiSecret: maskCredential(settings.vonageApiSecret),
      vonageApplicationId: maskCredential(settings.vonageApplicationId),
      metaAccessToken: maskCredential(settings.metaAccessToken),
      metaPhoneNumberId: maskCredential(settings.metaPhoneNumberId),
      metaAppSecret: maskCredential(settings.metaAppSecret),
    }

    return NextResponse.json({ success: true, data: masked })
  } catch (error) {
    console.error('[API] Integration settings PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update integration settings' },
      { status: 500 },
    )
  }
}
