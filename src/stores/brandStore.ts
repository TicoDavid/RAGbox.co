/**
 * brandStore — STORY-240: Letterhead Templates — Load Once, Apply Everywhere
 *
 * Persists brand configuration (letterhead templates + tone) across sessions
 * using Zustand's persist middleware (localStorage). Templates are stored as
 * base64 data URLs so they survive page refreshes without backend persistence.
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

type ToneOption = 'standard' | 'executive' | 'forensic'

interface TemplateFile {
  name: string
  dataUrl: string    // base64 data URL for localStorage persistence
  size: number
  uploadedAt: string // ISO date
}

interface BrandState {
  wordTemplate: TemplateFile | null
  slideTemplate: TemplateFile | null
  tone: ToneOption

  setWordTemplate: (file: File | null) => Promise<void>
  setSlideTemplate: (file: File | null) => Promise<void>
  setTone: (tone: ToneOption) => void
  clearTemplates: () => void
}

/** Convert File to base64 data URL for localStorage storage. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Reconstruct a File object from stored template data. */
export function templateToFile(template: TemplateFile): File {
  const byteString = atob(template.dataUrl.split(',')[1])
  const mimeMatch = template.dataUrl.match(/data:([^;]+);/)
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  return new File([ab], template.name, { type: mimeType })
}

export const useBrandStore = create<BrandState>()(
  devtools(
    persist(
      (set) => ({
        wordTemplate: null,
        slideTemplate: null,
        tone: 'standard',

        setWordTemplate: async (file) => {
          if (!file) {
            set({ wordTemplate: null })
            return
          }
          const dataUrl = await fileToDataUrl(file)
          set({
            wordTemplate: {
              name: file.name,
              dataUrl,
              size: file.size,
              uploadedAt: new Date().toISOString(),
            },
          })
        },

        setSlideTemplate: async (file) => {
          if (!file) {
            set({ slideTemplate: null })
            return
          }
          const dataUrl = await fileToDataUrl(file)
          set({
            slideTemplate: {
              name: file.name,
              dataUrl,
              size: file.size,
              uploadedAt: new Date().toISOString(),
            },
          })
        },

        setTone: (tone) => set({ tone }),

        clearTemplates: () =>
          set({ wordTemplate: null, slideTemplate: null, tone: 'standard' }),
      }),
      {
        name: 'ragbox-brand-config',
      },
    ),
  ),
)
