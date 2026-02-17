/**
 * RAGbox Public API — API Key Management
 *
 * GET  /api/v1/keys — List user's API keys (session auth only)
 * POST /api/v1/keys — Create new API key (returns raw key ONCE)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import prisma from '@/lib/prisma'
import { generateApiKey, revokeApiKey } from '@/lib/api/apiKeyManager'
import { writeAuditEntry } from '@/lib/audit/auditWriter'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Session authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''

  const keys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      isRevoked: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ success: true, data: { keys } })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Session authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''

  let body: { name?: string; scopes?: string[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ success: false, error: 'Key name is required' }, { status: 400 })
  }

  const validScopes = ['read', 'write', 'admin']
  const scopes = (body.scopes || ['read']).filter((s) => validScopes.includes(s))
  if (scopes.length === 0) scopes.push('read')

  const { key, apiKey } = await generateApiKey(userId, body.name.trim(), scopes)

  await writeAuditEntry(userId, 'apikey.create', apiKey.id, {
    name: body.name,
    scopes,
  })

  return NextResponse.json({
    success: true,
    data: {
      key, // Raw key — shown ONCE, never again
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      createdAt: apiKey.createdAt,
    },
  })
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json({ success: false, error: 'Session authentication required' }, { status: 401 })
  }

  const userId = (token.id as string) || token.email || ''
  const { searchParams } = new URL(request.url)
  const keyId = searchParams.get('id')

  if (!keyId) {
    return NextResponse.json({ success: false, error: 'Key ID required (?id=...)' }, { status: 400 })
  }

  const revoked = await revokeApiKey(keyId, userId)
  if (!revoked) {
    return NextResponse.json({ success: false, error: 'Key not found' }, { status: 404 })
  }

  await writeAuditEntry(userId, 'apikey.revoke', keyId)

  return NextResponse.json({ success: true })
}
