/**
 * Documents API - RAGbox.co
 *
 * GET  /api/documents — Proxy to Go backend (single source of truth)
 * POST /api/documents — Proxy upload to Go backend
 */

import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/backend-proxy'

export async function GET(request: NextRequest) {
  return proxyToBackend(request, { backendPath: '/api/documents' })
}

export async function POST(request: NextRequest) {
  return proxyToBackend(request)
}
