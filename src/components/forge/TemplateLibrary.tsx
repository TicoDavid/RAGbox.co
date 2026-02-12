'use client'

import { useState, useEffect } from 'react'
import { Library, Loader2, Plus } from 'lucide-react'
import TemplateCard from './TemplateCard'
import type { TemplateAnalysis } from '@/types/templateAnalysis'

interface TemplateLibraryProps {
  onSelect: (template: TemplateAnalysis) => void
  selectedTemplateId?: string
  onUploadClick: () => void
}

export default function TemplateLibrary({ onSelect, selectedTemplateId, onUploadClick }: TemplateLibraryProps) {
  const [templates, setTemplates] = useState<TemplateAnalysis[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    async function fetchTemplates() {
      try {
        const response = await fetch('/api/templates')
        if (response.ok) {
          const data = await response.json()
          setTemplates(data.templates || [])
        }
      } catch (error) {
      } finally {
        setIsLoading(false)
      }
    }
    fetchTemplates()
  }, [])

  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))]
  const filtered = filter === 'all' ? templates : templates.filter(t => t.category === filter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Library size={16} className="text-[#00F0FF]" />
          <span className="text-sm font-medium text-white">Template Library</span>
          <span className="text-[10px] text-[#666]">({templates.length})</span>
        </div>
        <button
          onClick={onUploadClick}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-[#00F0FF] border border-[#00F0FF]/30 hover:bg-[#00F0FF]/10 transition-colors"
        >
          <Plus size={12} />
          Upload
        </button>
      </div>

      {/* Category Filter */}
      {categories.length > 2 && (
        <div className="flex gap-1 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                filter === cat
                  ? 'bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30'
                  : 'bg-[#111] text-[#666] border border-[#222] hover:border-[#444]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Template List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="text-[#00F0FF] animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-xs text-[#666]">No templates found</div>
          <button
            onClick={onUploadClick}
            className="mt-2 text-[10px] text-[#00F0FF] hover:underline"
          >
            Upload your first template
          </button>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {filtered.map(template => (
            <TemplateCard
              key={template.templateId}
              template={template}
              onSelect={onSelect}
              isSelected={template.templateId === selectedTemplateId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
