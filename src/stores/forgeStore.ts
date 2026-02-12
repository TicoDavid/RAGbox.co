import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { AssetType, GeneratedAsset } from '@/types/ragbox'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'

interface ForgeState {
  assets: GeneratedAsset[]
  isGenerating: boolean
  currentGenerationType: AssetType | null

  generate: (type: AssetType, conversationContext: string) => Promise<void>
  downloadAsset: (assetId: string) => void
  deleteAsset: (assetId: string) => void
}

export const useForgeStore = create<ForgeState>()(
  devtools((set, get) => ({
    assets: [],
    isGenerating: false,
    currentGenerationType: null,

    generate: async (type, conversationContext) => {
      set({ isGenerating: true, currentGenerationType: type })

      try {
        const res = await apiFetch('/api/forge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateName: type,
            category: 'conversation-export',
            fields: [{ name: 'content', type: 'text', required: true }],
            fieldValues: { content: conversationContext },
            sourceContext: conversationContext,
          }),
        })

        if (!res.ok) throw new Error('Generation failed')

        const result = await res.json()
        const data = result.data ?? result

        const newAsset: GeneratedAsset = {
          id: data.id ?? `asset-${Date.now()}`,
          type,
          filename: data.fileName ?? `generated-${type}`,
          createdAt: new Date(),
          size: data.size ?? (data.content?.length ?? 0),
          downloadUrl: data.downloadUrl ?? '',
          status: 'complete',
        }

        set((state) => ({
          assets: [newAsset, ...state.assets],
          isGenerating: false,
          currentGenerationType: null,
        }))
      } catch (error) {
        set({ isGenerating: false, currentGenerationType: null })
        toast.error('Failed to generate asset')
        throw error
      }
    },

    downloadAsset: (assetId) => {
      const asset = get().assets.find(a => a.id === assetId)
      if (asset?.downloadUrl) {
        window.open(asset.downloadUrl, '_blank')
      }
    },

    deleteAsset: (assetId) => {
      set((state) => ({
        assets: state.assets.filter(a => a.id !== assetId),
      }))
    },
  }))
)
