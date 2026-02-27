/**
 * Store-level tests for studioStore.
 *
 * These tests verify payload shape and state transitions via mocked fetch.
 * They do NOT exercise actual API route processing. For backend route coverage,
 * see src/app/api/documents/[id]/privilege/route.test.ts.
 */
import { useStudioStore } from './studioStore'

// ── Helpers ──────────────────────────────────────────────────

function okJson(data: object) {
  return { ok: true, json: async () => data }
}

// ── Setup / Teardown ─────────────────────────────────────────

const originalFetch = global.fetch

beforeEach(() => {
  useStudioStore.setState({
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

describe('studioStore', () => {
  describe('generate – request payload', () => {
    test('sends template API contract fields', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        okJson({ data: { fileName: 'report.pdf', downloadUrl: '/dl/1', content: 'body' } }),
      )

      await useStudioStore.getState().generate('report', 'conversation text here')

      const call = (global.fetch as jest.Mock).mock.calls[0]
      expect(call[0]).toBe('/api/studio')

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

      await useStudioStore.getState().generate('pdf', 'ctx')

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

      await useStudioStore.getState().generate('pdf', 'ctx')

      const asset = useStudioStore.getState().assets[0]
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

      await useStudioStore.getState().generate('slides', 'ctx')

      const asset = useStudioStore.getState().assets[0]
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

      await useStudioStore.getState().generate('report', 'ctx')

      expect(useStudioStore.getState().assets[0].size).toBe(12)
    })

    test('defaults size to 0 when neither size nor content present', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        okJson({ data: { fileName: 'empty.pdf', downloadUrl: '/dl/y' } }),
      )

      await useStudioStore.getState().generate('table', 'ctx')

      expect(useStudioStore.getState().assets[0].size).toBe(0)
    })

    test('generates fallback id when not provided by API', async () => {
      jest.spyOn(Date, 'now').mockReturnValueOnce(1700000000000)

      ;(global.fetch as jest.Mock).mockResolvedValueOnce(
        okJson({ data: { fileName: 'x.pdf' } }),
      )

      await useStudioStore.getState().generate('chart', 'ctx')

      expect(useStudioStore.getState().assets[0].id).toBe('asset-1700000000000')

      jest.restoreAllMocks()
    })
  })

  describe('generate – error handling', () => {
    test('resets generating state on failure', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false })

      await expect(useStudioStore.getState().generate('pdf', 'ctx')).rejects.toThrow(
        'Generation failed',
      )

      const state = useStudioStore.getState()
      expect(state.isGenerating).toBe(false)
      expect(state.currentGenerationType).toBeNull()
      expect(state.assets).toHaveLength(0)
    })

    test('sets isGenerating during generation', async () => {
      let capturedState: { isGenerating: boolean; currentGenerationType: string | null } | null = null

      ;(global.fetch as jest.Mock).mockImplementationOnce(async () => {
        // Capture state while "in-flight"
        capturedState = {
          isGenerating: useStudioStore.getState().isGenerating,
          currentGenerationType: useStudioStore.getState().currentGenerationType,
        }
        return okJson({ data: { fileName: 'x.pdf' } })
      })

      await useStudioStore.getState().generate('image', 'ctx')

      expect(capturedState).toEqual({
        isGenerating: true,
        currentGenerationType: 'image',
      })
      expect(useStudioStore.getState().isGenerating).toBe(false)
    })
  })

  describe('generate – asset accumulation', () => {
    test('prepends new assets to the list', async () => {
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce(okJson({ data: { id: 'a1', fileName: 'first.pdf' } }))
        .mockResolvedValueOnce(okJson({ data: { id: 'a2', fileName: 'second.pdf' } }))

      await useStudioStore.getState().generate('pdf', 'ctx1')
      await useStudioStore.getState().generate('report', 'ctx2')

      const assets = useStudioStore.getState().assets
      expect(assets).toHaveLength(2)
      expect(assets[0].id).toBe('a2') // Most recent first
      expect(assets[1].id).toBe('a1')
    })
  })
})
