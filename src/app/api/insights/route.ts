import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/backend-proxy'

// GET /api/insights → Go backend GET /api/v1/insights
export async function GET(request: NextRequest) {
  return proxyToBackend(request, { backendPath: '/api/v1/insights' })
}

// POST /api/insights → Go backend POST /api/v1/insights/scan
export async function POST(request: NextRequest) {
  return proxyToBackend(request, { backendPath: '/api/v1/insights/scan' })
}
