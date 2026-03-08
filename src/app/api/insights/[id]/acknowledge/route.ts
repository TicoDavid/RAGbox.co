import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/backend-proxy'

// PATCH /api/insights/:id/acknowledge → Go backend PATCH /api/v1/insights/:id/acknowledge
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyToBackend(request, {
    backendPath: `/api/v1/insights/${id}/acknowledge`,
  })
}
