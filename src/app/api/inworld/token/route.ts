import { NextResponse } from 'next/server'

/**
 * @deprecated This endpoint is INSECURE and should not be used.
 *
 * It exposes API secrets to the browser which is a security anti-pattern.
 * Use /api/agent/session instead, which keeps all secrets server-side.
 *
 * This endpoint will be removed in the next release.
 */

export async function POST() {
  console.warn('[SECURITY] Deprecated /api/inworld/token endpoint called. Use /api/agent/session instead.')

  return NextResponse.json(
    {
      error: 'This endpoint is deprecated for security reasons',
      message: 'Use /api/agent/session for secure voice sessions',
      migration: {
        newEndpoint: '/api/agent/session',
        documentation: 'The new endpoint does not expose any API secrets to the browser',
      },
    },
    { status: 410 } // 410 Gone
  )
}
