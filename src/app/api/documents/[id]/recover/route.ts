import { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { proxyToBackend } from '@/lib/backend-proxy'
import { invalidateUserCache } from '@/lib/cache/queryCache'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const response = await proxyToBackend(request, { backendPath: `/api/documents/${id}/recover` })

  // E25-003: Invalidate query cache — recovered document may change RAG results
  if (response.status >= 200 && response.status < 400) {
    const token = await getToken({ req: request })
    const userId = (token?.id as string) || token?.email || ''
    if (userId) {
      invalidateUserCache(userId).catch(() => {})
    }
  }

  return response
}
