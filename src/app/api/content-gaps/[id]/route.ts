import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/backend-proxy'

export async function PATCH(request: NextRequest) {
  return proxyToBackend(request)
}
