import { useForgeStore } from './forgeStore'

// ── Helpers ──────────────────────────────────────────────────

function okJson(data: object) {
  return { ok: true, json: async () => data }
}

// ── Setup / Teardown ─────────────────────────────────────────

const originalFetch = global.fetch

beforeEach(() => {
  useForgeStore.setState({
    assets: [],
    isGenerating: false,
    currentGenerationType: null,
  })
  global.fetch = jest.fn()
})

afterAll(() => {
  global.fetch = originalFetch
})

// ── Tests ────────────────────────────────────────────────────

describe('forgeStore', () => {
  describe('generate – request payload', () => {
    test('sends template API contract fields', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        okJson({ data: { fileName: 'report.pdf', downloadUrl: '/dl/1', content: 'body' } }),
      )

      await useForgeStore.getState().generate('report', 'conversation text here')

      const call = (global.fetch as jest.Mock).mock.calls[0]
      expect(call[0]).toBe('/api/forge/generate')

      const body = JSON.parse(call[1].body)
      expect(body).toEqual({
        templateName: 'report',
        category: 'conversation-export',
        fields: [{ name: 'content', type: 'text', required: true }],
        fieldValues: { content: 'conversation text here' },
        sourceContext: 'conversation text here',
      })
    })

    test('does not send legacy type/context fields', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        okJson({ data: { fileName: 'out.pdf' } }),
      )

      await useForgeStore.getState().generate('pdf', 'ctx')

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(body).not.toHaveProperty('type')
      expect(body).not.toHaveProperty('context')
    })
  })

  describe('generate – response parsing', () => {
    test('parses nested data wrapper response', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        okJson({
          data: {
            id: 'asset-abc',
            fileName: 'export.pdf',
            downloadUrl: '/download/abc',
            content: 'generated content',
            size: 1234,
          },
        }),
      )

      await useForgeStore.getState().generate('pdf', 'ctx')

      const asset = useForgeStore.getState().assets[0]
      expect(asset.id).toBe('asset-abc')
      expect(asset.filename).toBe('export.pdf')
      expect(asset.downloadUrl).toBe('/download/abc')
      expect(asset.size).toBe(1234)
      expect(asset.type).toBe('pdf')
      expect(asset.status).toBe('complete')
    })

    test('handles flat response (no data wrapper)', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        okJson({
          id: 'flat-1',
          fileName: 'flat.pdf',
          downloadUrl: '/dl/flat',
          size: 500,
        }),
      )

      await useForgeStore.getState().generate('slides', 'ctx')

      const asset = useForgeStore.getState().assets[0]
      expect(asset.id).toBe('flat-1')
      expect(asset.filename).toBe('flat.pdf')
      expect(asset.size).toBe(500)
    })

    test('computes size from content length when size is missing', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        okJson({
          data: {
            fileName: 'doc.pdf',
            downloadUrl: '/dl/x',
            content: 'twelve chars', // 12 characters
          },
        }),
      )

      await useForgeStore.getState().generate('report', 'ctx')

      expect(useForgeStore.getState().assets[0].size).toBe(12)
    })

    test('defaults size to 0 when neither size nor content present', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        okJson({ data: { fileName: 'empty.pdf', downloadUrl: '/dl/y' } }),
      )

      await useForgeStore.getState().generate('table', 'ctx')

      expect(useForgeStore.getState().assets[0].size).toBe(0)
    })

    test('generates fallback id when not provided by API', async () => {
      jest.spyOn(Date, 'now').mockReturnValueOnce(1700000000000)

      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        okJson({ data: { fileName: 'x.pdf' } }),
      )

      await useForgeStore.getState().generate('chart', 'ctx')

      expect(useForgeStore.getState().assets[0].id).toBe('asset-1700000000000')

      jest.restoreAllMocks()
    })
  })

  describe('generate – error handling', () => {
    test('resets generating state on failure', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false })

      await expect(useForgeStore.getState().generate('pdf', 'ctx')).rejects.toThrow(
        'Generation failed',
      )

      const state = useForgeStore.getState()
      expect(state.isGenerating).toBe(false)
      expect(state.currentGenerationType).toBeNull()
      expect(state.assets).toHaveLength(0)
    })

    test('sets isGenerating during generation', async () => {
      let capturedState: { isGenerating: boolean; currentGenerationType: string | null } | null = null

      ;(global.fetch as jest.Mock).mockImplementationOnce(async () => {
        // Capture state while "in-flight"
        capturedState = {
          isGenerating: useForgeStore.getState().isGenerating,
          currentGenerationType: useForgeStore.getState().currentGenerationType,
        }
        return okJson({ data: { fileName: 'x.pdf' } })
      })

      await useForgeStore.getState().generate('image', 'ctx')

      expect(capturedState).toEqual({
        isGenerating: true,
        currentGenerationType: 'image',
      })
      expect(useForgeStore.getState().isGenerating).toBe(false)
    })
  })

  describe('generate – asset accumulation', () => {
    test('prepends new assets to the list', async () => {
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce(okJson({ data: { id: 'a1', fileName: 'first.pdf' } }))
        .mockResolvedValueOnce(okJson({ data: { id: 'a2', fileName: 'second.pdf' } }))

      await useForgeStore.getState().generate('pdf', 'ctx1')
      await useForgeStore.getState().generate('report', 'ctx2')

      const assets = useForgeStore.getState().assets
      expect(assets).toHaveLength(2)
      expect(assets[0].id).toBe('a2') // Most recent first
      expect(assets[1].id).toBe('a1')
    })
  })
})
