/**
 * Store-level tests for privilegeStore.
 *
 * Tests initial state, toggle behavior, fetch behavior,
 * and error handling for the privilege mode system.
 */

// ── Mocks ──────────────────────────────────────────────────

// Mock apiFetch before importing the store
jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}))

import { usePrivilegeStore } from '../privilegeStore'
import { apiFetch } from '@/lib/api'

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>

// ── Helpers ──────────────────────────────────────────────────

function okJson(data: object): Partial<Response> {
  return { ok: true, json: async () => data } as Partial<Response>
}

function errorResponse(status: number): Partial<Response> {
  return { ok: false, status } as Partial<Response>
}

// ── Setup / Teardown ─────────────────────────────────────────

beforeEach(() => {
  // Reset store state
  usePrivilegeStore.setState({
    isEnabled: false,
    lastChanged: null,
  })
  mockApiFetch.mockReset()
})

// ── Tests ────────────────────────────────────────────────────

describe('privilegeStore', () => {
  describe('initial state', () => {
    test('isEnabled defaults to false', () => {
      expect(usePrivilegeStore.getState().isEnabled).toBe(false)
    })

    test('lastChanged defaults to null', () => {
      expect(usePrivilegeStore.getState().lastChanged).toBeNull()
    })

    test('has toggle and fetch actions', () => {
      const state = usePrivilegeStore.getState()
      expect(typeof state.toggle).toBe('function')
      expect(typeof state.fetch).toBe('function')
    })
  })

  describe('toggle', () => {
    test('flips isEnabled from false to true on success', async () => {
      mockApiFetch.mockResolvedValueOnce(okJson({}) as Response)

      await usePrivilegeStore.getState().toggle()

      expect(usePrivilegeStore.getState().isEnabled).toBe(true)
    })

    test('flips isEnabled from true to false on success', async () => {
      usePrivilegeStore.setState({ isEnabled: true })
      mockApiFetch.mockResolvedValueOnce(okJson({}) as Response)

      await usePrivilegeStore.getState().toggle()

      expect(usePrivilegeStore.getState().isEnabled).toBe(false)
    })

    test('sends POST to /api/privilege with new state', async () => {
      mockApiFetch.mockResolvedValueOnce(okJson({}) as Response)

      await usePrivilegeStore.getState().toggle()

      expect(mockApiFetch).toHaveBeenCalledWith('/api/privilege', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privileged: true }),
      })
    })

    test('sends privileged:false when toggling off', async () => {
      usePrivilegeStore.setState({ isEnabled: true })
      mockApiFetch.mockResolvedValueOnce(okJson({}) as Response)

      await usePrivilegeStore.getState().toggle()

      const body = JSON.parse(
        (mockApiFetch.mock.calls[0][1] as RequestInit).body as string
      )
      expect(body.privileged).toBe(false)
    })

    test('sets lastChanged timestamp on success', async () => {
      mockApiFetch.mockResolvedValueOnce(okJson({}) as Response)

      const before = new Date()
      await usePrivilegeStore.getState().toggle()
      const after = new Date()

      const lastChanged = usePrivilegeStore.getState().lastChanged
      expect(lastChanged).not.toBeNull()
      expect(lastChanged!.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(lastChanged!.getTime()).toBeLessThanOrEqual(after.getTime())
    })

    test('throws on non-ok response and does not change state', async () => {
      mockApiFetch.mockResolvedValueOnce(errorResponse(500) as Response)

      await expect(usePrivilegeStore.getState().toggle()).rejects.toThrow(
        'Privilege toggle failed'
      )
      expect(usePrivilegeStore.getState().isEnabled).toBe(false)
    })

    test('does not update lastChanged on failure', async () => {
      mockApiFetch.mockResolvedValueOnce(errorResponse(403) as Response)

      try {
        await usePrivilegeStore.getState().toggle()
      } catch {
        // expected
      }

      expect(usePrivilegeStore.getState().lastChanged).toBeNull()
    })
  })

  describe('fetch', () => {
    test('fetches current privilege state from API', async () => {
      mockApiFetch.mockResolvedValueOnce(
        okJson({ data: { privilegeMode: true } }) as Response
      )

      await usePrivilegeStore.getState().fetch()

      expect(mockApiFetch).toHaveBeenCalledWith('/api/privilege')
      expect(usePrivilegeStore.getState().isEnabled).toBe(true)
    })

    test('handles flat response shape (isPrivileged field)', async () => {
      mockApiFetch.mockResolvedValueOnce(
        okJson({ isPrivileged: true }) as Response
      )

      await usePrivilegeStore.getState().fetch()

      expect(usePrivilegeStore.getState().isEnabled).toBe(true)
    })

    test('defaults to false when response lacks privilege fields', async () => {
      usePrivilegeStore.setState({ isEnabled: true })
      mockApiFetch.mockResolvedValueOnce(okJson({}) as Response)

      await usePrivilegeStore.getState().fetch()

      expect(usePrivilegeStore.getState().isEnabled).toBe(false)
    })

    test('silently ignores fetch errors', async () => {
      usePrivilegeStore.setState({ isEnabled: true })
      mockApiFetch.mockRejectedValueOnce(new Error('Network error'))

      // Should not throw
      await usePrivilegeStore.getState().fetch()

      // State unchanged on error
      expect(usePrivilegeStore.getState().isEnabled).toBe(true)
    })

    test('silently ignores non-ok responses', async () => {
      usePrivilegeStore.setState({ isEnabled: true })
      mockApiFetch.mockResolvedValueOnce(errorResponse(500) as Response)

      // Should not throw
      await usePrivilegeStore.getState().fetch()

      // State unchanged (error caught silently)
      expect(usePrivilegeStore.getState().isEnabled).toBe(true)
    })
  })
})
