/**
 * Shared proxy utility for forwarding Next.js API requests to the Go backend.
 *
 * Validates the NextAuth session, then forwards with X-Internal-Auth + X-User-ID
 * headers so the Go backend trusts the request without Firebase tokens.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''

interface ProxyOptions {
  /** Override the backend path (defaults to request pathname). */
  backendPath?: string
  /** Extra query params to append. */
  extraQuery?: Record<string, string>
}

/**
 * Proxy a request to the Go backend with internal auth headers.
 * Handles JSON, SSE streaming, and binary (ZIP) responses.
 */
export async function proxyToBackend(
  request: NextRequest,
  options?: ProxyOptions
): Promise<NextResponse | Response> {
  // Auth check — decode JWT directly from cookie (no internal HTTP call)
  const token = await getToken({ req: request })
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }

  const userId = (token.id as string) || token.email || ''
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Unable to determine user identity' },
      { status: 401 }
    )
  }

  // Build backend URL
  const backendPath = options?.backendPath ?? request.nextUrl.pathname
  const url = new URL(backendPath, GO_BACKEND_URL)

  // Forward query params from the original request
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value)
  })

  // Apply extra query params
  if (options?.extraQuery) {
    for (const [key, value] of Object.entries(options.extraQuery)) {
      url.searchParams.set(key, value)
    }
  }

  // Build headers — internal auth + content type
  const headers: Record<string, string> = {
    'X-Internal-Auth': INTERNAL_AUTH_SECRET,
    'X-User-ID': userId,
  }

  const contentType = request.headers.get('content-type')
  if (contentType) {
    headers['Content-Type'] = contentType
  }

  // Forward the request body for non-GET methods
  let body: BodyInit | undefined
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    body = await request.arrayBuffer().then(buf => buf.byteLength > 0 ? buf : undefined)
  }

  // Timeout: 30s for normal requests, none for SSE (handled by client disconnect)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  let backendResponse: Response
  try {
    backendResponse = await fetch(url.toString(), {
      method: request.method,
      headers,
      body,
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof DOMException && err.name === 'AbortError') {
      return NextResponse.json(
        { success: false, error: 'Backend request timed out' },
        { status: 504 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Failed to reach backend' },
      { status: 502 }
    )
  }
  clearTimeout(timeout)

  const respContentType = backendResponse.headers.get('content-type') ?? ''

  // SSE streaming — pass through directly
  if (respContentType.includes('text/event-stream')) {
    return new Response(backendResponse.body, {
      status: backendResponse.status,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  }

  // Binary response (ZIP, PDF, etc.) — pass through
  if (
    respContentType.includes('application/zip') ||
    respContentType.includes('application/pdf') ||
    respContentType.includes('application/octet-stream')
  ) {
    const respHeaders = new Headers()
    respHeaders.set('Content-Type', respContentType)
    const disposition = backendResponse.headers.get('content-disposition')
    if (disposition) {
      respHeaders.set('Content-Disposition', disposition)
    }
    return new Response(backendResponse.body, {
      status: backendResponse.status,
      headers: respHeaders,
    })
  }

  // Plain text response (audit export)
  if (respContentType.includes('text/plain')) {
    const text = await backendResponse.text()
    const respHeaders = new Headers()
    respHeaders.set('Content-Type', respContentType)
    const disposition = backendResponse.headers.get('content-disposition')
    if (disposition) {
      respHeaders.set('Content-Disposition', disposition)
    }
    return new Response(text, {
      status: backendResponse.status,
      headers: respHeaders,
    })
  }

  // JSON response — pass through
  try {
    const data = await backendResponse.json()
    return NextResponse.json(data, { status: backendResponse.status })
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid response from backend' },
      { status: 502 }
    )
  }
}
