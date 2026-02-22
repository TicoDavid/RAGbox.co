/**
 * Documents API - RAGbox.co
 *
 * GET  /api/documents — Proxy to Go backend (single source of truth)
 * POST /api/documents — Proxy upload to Go backend (tier-gated)
 */

import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/backend-proxy'
import { checkVaultUpload } from '@/lib/auth/tierCheck'

export async function GET(request: NextRequest) {
  return proxyToBackend(request, { backendPath: '/api/documents' })
}

export async function POST(request: NextRequest) {
  // Tier enforcement: check vault storage limit before upload
  const gate = await checkVaultUpload(request)
  if (!gate.allowed) return gate.response

  return proxyToBackend(request)
}
