import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { proxyToBackend } from '@/lib/backend-proxy'
import { invalidateUserCache } from '@/lib/cache/queryCache'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyToBackend(request, { backendPath: `/api/documents/${id}` })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const response = await proxyToBackend(request, { backendPath: `/api/documents/${id}` })

  // E25-003: Invalidate query cache — deleted document may change RAG results
  if (response.status >= 200 && response.status < 400) {
    const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET })
    const userId = (token?.id as string) || token?.email || ''
    if (userId) {
      invalidateUserCache(userId).catch(() => {})
    }
  }

  return response
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return proxyToBackend(request, { backendPath: `/api/documents/${id}` })
}
