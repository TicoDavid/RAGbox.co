/**
 * Documents API - RAGbox.co
 *
 * GET  /api/documents — Proxy to Go backend (single source of truth)
 * POST /api/documents — Proxy upload to Go backend (tier-gated)
 */

import { NextRequest, NextResponse } from 'next/server'
import { proxyToBackend } from '@/lib/backend-proxy'
import { checkVaultUpload } from '@/lib/auth/tierCheck'
import { checkUsageLimit } from '@/lib/billing/tierEnforcement'

export async function GET(request: NextRequest) {
  return proxyToBackend(request, { backendPath: '/api/documents' })
}

export async function POST(request: NextRequest) {
  // Tier enforcement: check vault storage limit before upload
  const gate = await checkVaultUpload(request)
  if (!gate.allowed) return gate.response

  // EPIC-031: Document count limit enforcement
  const docLimit = await checkUsageLimit(gate.userId, 'document_count')
  if (!docLimit.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: 'Document limit reached. Upgrade your plan for more documents.',
        current: docLimit.current,
        limit: docLimit.limit,
        tier: docLimit.tier,
        upgradeUrl: '/pricing',
      },
      { status: 403 },
    )
  }

  return proxyToBackend(request)
}
