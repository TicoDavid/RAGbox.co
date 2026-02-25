/**
 * LLM Config Settings API — BYOLLM (Bring Your Own LLM)
 *
 * GET  /api/settings/llm  — Read tenant LLM config (masked key)
 * PUT  /api/settings/llm  — Create or update tenant LLM config
 * DELETE /api/settings/llm — Remove tenant LLM config
 *
 * All routes require authentication via NextAuth JWT.
 * API keys are encrypted before storage and masked in all responses.
 *
 * STORY-021
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { maskApiKey } from '@/lib/utils/mask-key'
import { encryptKey, decryptKey } from '@/lib/utils/kms'
import { checkByollm } from '@/lib/auth/tierCheck'
import { logger } from '@/lib/logger'

const DEFAULT_TENANT = 'default'

const VALID_PROVIDERS = ['openrouter', 'openai', 'anthropic', 'google'] as const
const VALID_POLICIES = ['choice', 'byollm_only', 'aegis_only'] as const

const PutSchema = z.object({
  provider: z.enum(VALID_PROVIDERS).optional(),
  apiKey: z.string().min(1).max(500).optional(),
  baseUrl: z.string().url().max(500).optional().nullable(),
  defaultModel: z.string().min(1).max(200).optional().nullable(),
  policy: z.enum(VALID_POLICIES).optional(),
})

/**
 * Serialize an LLMConfig record into the safe response shape.
 * Decrypts the key only to mask it — never returns the full key.
 */
async function serializeConfig(config: {
  provider: string
  apiKeyEncrypted: string
  baseUrl: string | null
  defaultModel: string | null
  policy: string
  lastTestedAt: Date | null
  lastTestResult: string | null
  lastTestLatency: number | null
}) {
  let maskedKey = '***'
  try {
    const raw = await decryptKey(config.apiKeyEncrypted)
    maskedKey = maskApiKey(raw)
  } catch {
    // If decryption fails, show fully masked
    maskedKey = '***'
  }

  return {
    configured: true,
    provider: config.provider,
    maskedKey,
    baseUrl: config.baseUrl,
    defaultModel: config.defaultModel,
    policy: config.policy,
    lastTestedAt: config.lastTestedAt?.toISOString() ?? null,
    lastTestResult: config.lastTestResult,
    lastTestLatency: config.lastTestLatency,
  }
}

// ── GET /api/settings/llm ───────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    const config = await prisma.lLMConfig.findUnique({
      where: { tenantId: DEFAULT_TENANT },
    })

    if (!config) {
      return NextResponse.json({
        success: true,
        data: { configured: false, policy: 'choice' },
      })
    }

    const data = await serializeConfig(config)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('[Settings/LLM] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load LLM settings' },
      { status: 500 },
    )
  }
}

// ── PUT /api/settings/llm ───────────────────────────────────

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    // Tier enforcement: BYOLLM requires sovereign+ tier
    const gate = await checkByollm(request)
    if (!gate.allowed) return gate.response

    const body = await request.json()
    const parsed = PutSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { provider, apiKey, baseUrl, defaultModel, policy } = parsed.data

    // Build update payload — only include fields that were provided
    const updateData: Record<string, unknown> = {}
    if (provider !== undefined) updateData.provider = provider
    if (baseUrl !== undefined) updateData.baseUrl = baseUrl
    if (defaultModel !== undefined) updateData.defaultModel = defaultModel
    if (policy !== undefined) updateData.policy = policy

    // Encrypt API key if provided
    if (apiKey) {
      updateData.apiKeyEncrypted = await encryptKey(apiKey)
    }

    // Upsert: create if missing, update if exists
    const existing = await prisma.lLMConfig.findUnique({
      where: { tenantId: DEFAULT_TENANT },
    })

    let config
    if (existing) {
      config = await prisma.lLMConfig.update({
        where: { tenantId: DEFAULT_TENANT },
        data: updateData,
      })
    } else {
      // Creating new — apiKey is required for initial setup
      if (!apiKey) {
        return NextResponse.json(
          { success: false, error: 'API key is required for initial configuration' },
          { status: 400 },
        )
      }
      config = await prisma.lLMConfig.create({
        data: {
          tenantId: DEFAULT_TENANT,
          provider: provider ?? 'openrouter',
          apiKeyEncrypted: updateData.apiKeyEncrypted as string,
          baseUrl: baseUrl ?? null,
          defaultModel: defaultModel ?? null,
          policy: policy ?? 'choice',
        },
      })
    }

    const data = await serializeConfig(config)
    return NextResponse.json({ success: true, data })
  } catch (error) {
    logger.error('[Settings/LLM] PUT error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save LLM settings' },
      { status: 500 },
    )
  }
}

// ── DELETE /api/settings/llm ────────────────────────────────

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const token = await getToken({ req: request })
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      )
    }

    const existing = await prisma.lLMConfig.findUnique({
      where: { tenantId: DEFAULT_TENANT },
    })

    if (!existing) {
      return NextResponse.json({ success: true, deleted: false, message: 'No configuration to delete' })
    }

    await prisma.lLMConfig.delete({
      where: { tenantId: DEFAULT_TENANT },
    })

    return NextResponse.json({ success: true, deleted: true })
  } catch (error) {
    logger.error('[Settings/LLM] DELETE error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete LLM settings' },
      { status: 500 },
    )
  }
}
