'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Download, Loader2 } from 'lucide-react'

interface MindMapPreviewProps {
  mermaidCode: string
  title?: string
}

export function MindMapPreview({ mermaidCode, title }: MindMapPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgContent, setSvgContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function renderDiagram() {
      try {
        setLoading(true)
        setError(null)

        // Dynamic import — mermaid is a heavy library, only load when needed
        const { default: mermaid } = await import('mermaid')

        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            primaryColor: '#2463EB',
            primaryTextColor: '#E5E7EB',
            primaryBorderColor: '#233554',
            lineColor: '#94A3B8',
            secondaryColor: '#112240',
            tertiaryColor: '#1B2D4B',
          },
        })

        const id = `mindmap-${Date.now()}`
        const { svg } = await mermaid.render(id, mermaidCode)

        if (!cancelled) {
          setSvgContent(svg)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram')
          setLoading(false)
        }
      }
    }

    renderDiagram()
    return () => { cancelled = true }
  }, [mermaidCode])

  const handleDownloadSvg = useCallback(() => {
    if (!svgContent) return
    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'mindmap'}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }, [svgContent, title])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 text-[var(--brand-blue)] animate-spin" />
        <span className="ml-2 text-xs text-[var(--text-tertiary)]">Rendering diagram...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-3 rounded-lg bg-[var(--danger)]/10 border border-[var(--danger)]/20">
        <p className="text-xs text-[var(--danger)]">Render error: {error}</p>
        <pre className="mt-2 text-[10px] text-[var(--text-tertiary)] overflow-x-auto whitespace-pre-wrap">{mermaidCode}</pre>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* SVG render area */}
      <div
        ref={containerRef}
        className="rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)] p-3 overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svgContent ?? '' }}
      />

      {/* Download SVG button */}
      <button
        onClick={handleDownloadSvg}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] hover:bg-[var(--brand-blue)]/20 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Download SVG
      </button>
    </div>
  )
}
