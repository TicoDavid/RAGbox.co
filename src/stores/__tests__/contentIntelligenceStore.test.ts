import { useContentIntelligenceStore } from '../contentIntelligenceStore'
import type { ContentGap, KBHealthCheck } from '@/types/ragbox'

const defaultFetchResponse = { ok: true, json: async () => ({}) }
const originalFetch = global.fetch

// Silence expected console.error from store catch blocks
let errorSpy: jest.SpyInstance

beforeEach(() => {
  useContentIntelligenceStore.setState({
    gaps: [],
    gapSummary: null,
    gapsLoading: false,
    healthChecks: [],
    healthLoading: false,
    lastHealthRun: null,
  })
  global.fetch = jest.fn().mockResolvedValue(defaultFetchResponse)
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  errorSpy.mockRestore()
})

afterAll(() => {
  global.fetch = originalFetch
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchJson(data: unknown, ok = true) {
  ;(global.fetch as jest.Mock).mockResolvedValue({
    ok,
    json: async () => data,
  })
}

function makeGap(overrides: Partial<ContentGap> = {}): ContentGap {
  return {
    id: 'gap-1',
    userId: 'user-1',
    queryText: 'What is HIPAA?',
    confidenceScore: 0.4,
    suggestedTopics: ['HIPAA basics'],
    status: 'open',
    createdAt: new Date(),
    ...overrides,
  }
}

function makeHealthCheck(overrides: Partial<KBHealthCheck> = {}): KBHealthCheck {
  return {
    id: 'hc-1',
    vaultId: 'vault-1',
    checkType: 'freshness',
    status: 'passed',
    details: {},
    runAt: new Date(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('contentIntelligenceStore', () => {
  // 8. initial state has correct defaults
  test('initial state has correct defaults', () => {
    const state = useContentIntelligenceStore.getState()
    expect(state.gaps).toEqual([])
    expect(state.gapSummary).toBeNull()
    expect(state.gapsLoading).toBe(false)
    expect(state.healthChecks).toEqual([])
    expect(state.healthLoading).toBe(false)
    expect(state.lastHealthRun).toBeNull()
  })

  // -------------------------------------------------------------------------
  // fetchGaps
  // -------------------------------------------------------------------------

  describe('fetchGaps', () => {
    test('success sets gaps and gapSummary, clears gapsLoading', async () => {
      const gap1 = makeGap({ id: 'g-1' })
      const gap2 = makeGap({ id: 'g-2' })

      mockFetchJson({
        success: true,
        data: { gaps: [gap1, gap2], openCount: 2 },
      })

      await useContentIntelligenceStore.getState().fetchGaps()

      const state = useContentIntelligenceStore.getState()
      expect(state.gaps).toEqual([gap1, gap2])
      expect(state.gapSummary).toEqual({ openGaps: 2 })
      expect(state.gapsLoading).toBe(false)

      // Verify correct URL was called
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/content-gaps?status=open&limit=50'),
        expect.any(Object),
      )
    })

    test('failure sets gapsLoading to false', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      await useContentIntelligenceStore.getState().fetchGaps()

      const state = useContentIntelligenceStore.getState()
      expect(state.gapsLoading).toBe(false)
      expect(state.gaps).toEqual([])
    })

    test('non-ok response leaves gaps empty and clears gapsLoading', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        json: async () => ({ success: false }),
      })

      await useContentIntelligenceStore.getState().fetchGaps()

      const state = useContentIntelligenceStore.getState()
      expect(state.gapsLoading).toBe(false)
      expect(state.gaps).toEqual([])
    })
  })

  // -------------------------------------------------------------------------
  // fetchGapSummary
  // -------------------------------------------------------------------------

  describe('fetchGapSummary', () => {
    test('success sets gapSummary', async () => {
      mockFetchJson({
        success: true,
        data: { openGaps: 7 },
      })

      await useContentIntelligenceStore.getState().fetchGapSummary()

      const state = useContentIntelligenceStore.getState()
      expect(state.gapSummary).toEqual({ openGaps: 7 })

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/content-gaps/summary'),
        expect.any(Object),
      )
    })
  })

  // -------------------------------------------------------------------------
  // dismissGap
  // -------------------------------------------------------------------------

  describe('dismissGap', () => {
    test('success removes gap from array and decrements openGaps', async () => {
      const gap1 = makeGap({ id: 'g-1' })
      const gap2 = makeGap({ id: 'g-2' })

      useContentIntelligenceStore.setState({
        gaps: [gap1, gap2],
        gapSummary: { openGaps: 2 },
      })

      mockFetchJson({})

      await useContentIntelligenceStore.getState().dismissGap('g-1')

      const state = useContentIntelligenceStore.getState()
      expect(state.gaps).toHaveLength(1)
      expect(state.gaps[0].id).toBe('g-2')
      expect(state.gapSummary).toEqual({ openGaps: 1 })

      // Verify PATCH with correct body
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/content-gaps/g-1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'dismissed' }),
        }),
      )
    })

    test('openGaps does not go below zero', async () => {
      const gap1 = makeGap({ id: 'g-1' })

      useContentIntelligenceStore.setState({
        gaps: [gap1],
        gapSummary: { openGaps: 0 },
      })

      mockFetchJson({})

      await useContentIntelligenceStore.getState().dismissGap('g-1')

      const state = useContentIntelligenceStore.getState()
      expect(state.gapSummary).toEqual({ openGaps: 0 })
    })
  })

  // -------------------------------------------------------------------------
  // addressGap
  // -------------------------------------------------------------------------

  describe('addressGap', () => {
    test('success removes gap from array and decrements openGaps', async () => {
      const gap1 = makeGap({ id: 'g-1' })
      const gap2 = makeGap({ id: 'g-2' })

      useContentIntelligenceStore.setState({
        gaps: [gap1, gap2],
        gapSummary: { openGaps: 2 },
      })

      mockFetchJson({})

      await useContentIntelligenceStore.getState().addressGap('g-1')

      const state = useContentIntelligenceStore.getState()
      expect(state.gaps).toHaveLength(1)
      expect(state.gaps[0].id).toBe('g-2')
      expect(state.gapSummary).toEqual({ openGaps: 1 })

      // Verify PATCH with 'addressed' status
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/content-gaps/g-1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ status: 'addressed' }),
        }),
      )
    })

    test('null gapSummary stays null after address', async () => {
      const gap1 = makeGap({ id: 'g-1' })

      useContentIntelligenceStore.setState({
        gaps: [gap1],
        gapSummary: null,
      })

      mockFetchJson({})

      await useContentIntelligenceStore.getState().addressGap('g-1')

      const state = useContentIntelligenceStore.getState()
      expect(state.gaps).toEqual([])
      expect(state.gapSummary).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // runHealthCheck
  // -------------------------------------------------------------------------

  describe('runHealthCheck', () => {
    test('success prepends to healthChecks and sets lastHealthRun', async () => {
      const existingCheck = makeHealthCheck({ id: 'hc-existing' })
      useContentIntelligenceStore.setState({ healthChecks: [existingCheck] })

      const freshness = makeHealthCheck({ id: 'hc-fresh', checkType: 'freshness' })
      const coverage = makeHealthCheck({ id: 'hc-cover', checkType: 'coverage' })

      mockFetchJson({
        success: true,
        data: { freshness, coverage },
      })

      await useContentIntelligenceStore.getState().runHealthCheck('vault-1')

      const state = useContentIntelligenceStore.getState()
      expect(state.healthChecks).toHaveLength(3)
      expect(state.healthChecks[0].id).toBe('hc-fresh')
      expect(state.healthChecks[1].id).toBe('hc-cover')
      expect(state.healthChecks[2].id).toBe('hc-existing')
      expect(state.lastHealthRun).toBeInstanceOf(Date)
      expect(state.healthLoading).toBe(false)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/vaults/vault-1/health-check'),
        expect.objectContaining({ method: 'POST' }),
      )
    })

    test('failure clears healthLoading', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Server error'))

      await useContentIntelligenceStore.getState().runHealthCheck('vault-1')

      const state = useContentIntelligenceStore.getState()
      expect(state.healthLoading).toBe(false)
      expect(state.lastHealthRun).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // fetchHealthHistory
  // -------------------------------------------------------------------------

  describe('fetchHealthHistory', () => {
    test('success sets healthChecks', async () => {
      const hc1 = makeHealthCheck({ id: 'hc-1' })
      const hc2 = makeHealthCheck({ id: 'hc-2' })

      mockFetchJson({
        success: true,
        data: [hc1, hc2],
      })

      await useContentIntelligenceStore.getState().fetchHealthHistory('vault-1')

      const state = useContentIntelligenceStore.getState()
      expect(state.healthChecks).toEqual([hc1, hc2])

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/vaults/vault-1/health-checks'),
        expect.any(Object),
      )
    })
  })
})
