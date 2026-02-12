/**
 * Integration tests for the apiFetch helper.
 *
 * Verifies auth token attachment, URL construction,
 * and error handling for the API client layer.
 */

// ── Mocks ──────────────────────────────────────────────────

// Mock next-auth/react before importing apiFetch
const mockGetSession = jest.fn()

jest.mock('next-auth/react', () => ({
  getSession: (...args: unknown[]) => mockGetSession(...args),
}))

import { apiFetch, apiUrl } from '../api'

// ── Setup / Teardown ─────────────────────────────────────────

const originalFetch = global.fetch
const originalEnv = process.env.NEXT_PUBLIC_API_URL

beforeEach(() => {
  global.fetch = jest.fn()
  mockGetSession.mockReset()
  // Default: no cross-origin API URL
  delete process.env.NEXT_PUBLIC_API_URL
})

afterAll(() => {
  global.fetch = originalFetch
  if (originalEnv !== undefined) {
    process.env.NEXT_PUBLIC_API_URL = originalEnv
  } else {
    delete process.env.NEXT_PUBLIC_API_URL
  }
})

// ── Tests ────────────────────────────────────────────────────

describe('apiUrl', () => {
  test('returns path as-is when NEXT_PUBLIC_API_URL is not set', () => {
    delete process.env.NEXT_PUBLIC_API_URL
    // apiUrl reads from module-level const, which was captured at import time.
    // Since we didn't set it before import, it should be empty string.
    const url = apiUrl('/api/documents')
    expect(url).toBe('/api/documents')
  })
})

describe('apiFetch', () => {
  test('calls fetch with the correct URL for same-origin requests', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    })

    await apiFetch('/api/documents')

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [url] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe('/api/documents')
  })

  test('passes through RequestInit options to fetch', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    await apiFetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ query: 'test' }),
    })

    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ query: 'test' })
  })

  test('uses same-origin credentials when API_URL is not set', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    await apiFetch('/api/documents')

    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    expect(init.credentials).toBe('same-origin')
  })

  test('does not attach Authorization header for same-origin requests', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    await apiFetch('/api/documents')

    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    const headers = init.headers as Headers
    expect(headers.has('Authorization')).toBe(false)
  })

  test('returns the Response object from fetch', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse)

    const result = await apiFetch('/api/documents')

    expect(result).toBe(mockResponse)
  })

  test('propagates fetch errors (network failure)', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    await expect(apiFetch('/api/documents')).rejects.toThrow('Failed to fetch')
  })

  test('does not swallow non-ok responses (lets caller handle)', async () => {
    const errorResponse = {
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    }
    ;(global.fetch as jest.Mock).mockResolvedValueOnce(errorResponse)

    const result = await apiFetch('/api/documents')

    // apiFetch does NOT throw on non-ok — it returns the response
    expect(result.ok).toBe(false)
    expect(result.status).toBe(401)
  })

  test('merges custom headers with init headers', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    await apiFetch('/api/chat', {
      headers: { 'Content-Type': 'application/json' },
    })

    const [, init] = (global.fetch as jest.Mock).mock.calls[0]
    const headers = init.headers as Headers
    expect(headers.get('Content-Type')).toBe('application/json')
  })
})
