/**
 * API Key Authentication Middleware
 *
 * Authenticates requests via X-API-Key header or Authorization: Bearer header.
 */

import { NextRequest } from 'next/server'
import { validateApiKey } from './apiKeyManager'

export interface ApiKeyAuth {
  userId: string
  userEmail: string
  userName: string | null
  keyId: string
  scopes: string[]
}

/**
 * Authenticate a request via API key.
 * Returns auth info if valid, null if not.
 */
export async function authenticateApiKey(request: NextRequest): Promise<ApiKeyAuth | null> {
  // Check X-API-Key header first, then Authorization: Bearer
  let rawKey = request.headers.get('x-api-key')
  if (!rawKey) {
    const auth = request.headers.get('authorization')
    if (auth?.startsWith('Bearer rbx_live_')) {
      rawKey = auth.slice(7)
    }
  }

  if (!rawKey) return null

  const apiKey = await validateApiKey(rawKey)
  if (!apiKey) return null

  return {
    userId: apiKey.userId,
    userEmail: apiKey.user.email,
    userName: apiKey.user.name,
    keyId: apiKey.id,
    scopes: apiKey.scopes,
  }
}

/**
 * Check if the authenticated key has a required scope.
 */
export function hasScope(auth: ApiKeyAuth, requiredScope: string): boolean {
  return auth.scopes.includes(requiredScope) || auth.scopes.includes('admin')
}
