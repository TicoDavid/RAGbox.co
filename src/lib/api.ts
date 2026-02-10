/**
 * API client for the Go backend.
 * Uses NEXT_PUBLIC_API_URL env var, falling back to relative URLs.
 * Attaches session auth token to all requests.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || ''

export function apiUrl(path: string): string {
  return `${API_URL}${path}`
}

/**
 * Fetch wrapper that attaches auth headers.
 * Uses the session token from NextAuth via cookies (automatic for same-origin).
 * For cross-origin Go API, attach the token explicitly.
 */
export async function apiFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const url = apiUrl(path)
  const headers = new Headers(init?.headers)

  // If cross-origin, we need to get and attach the token
  if (API_URL) {
    try {
      // Dynamically import to avoid SSR issues
      const { getSession } = await import('next-auth/react')
      const session = await getSession()
      const accessToken = (session as Record<string, unknown> | null)?.accessToken as string | undefined
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`)
      }
      // If no token is available, the request proceeds without auth.
      // The backend will return 401 for protected routes.
    } catch {
      // Fallback: cookies will be sent automatically for same-origin
    }
  }

  return fetch(url, {
    ...init,
    headers,
    credentials: API_URL ? 'include' : 'same-origin',
  })
}
