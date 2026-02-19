'use client'

import { FileText, Calendar, Tag } from 'lucide-react'
import type { TemplateAnalysis } from '@/types/templateAnalysis'

interface TemplateCardProps {
  template: TemplateAnalysis
  onSelect: (template: TemplateAnalysis) => void
  isSelected?: boolean
}

const categoryColors: Record<string, string> = {
  legal: 'var(--warning)',
  financial: 'var(--brand-blue)',
  medical: '#FF3D00',
  general: 'var(--text-tertiary)',
}

export default function TemplateCard({ template, onSelect, isSelected }: TemplateCardProps) {
  const color = categoryColors[template.category] || categoryColors.general

  return (
    <button
      onClick={() => onSelect(template)}
      className={`w-full text-left rounded-lg border p-4 transition-all ${
        isSelected
          ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 shadow-[0_0_12px_rgba(0,240,255,0.15)]'
          : 'border-[var(--bg-tertiary)] bg-[var(--bg-primary)] hover:border-[var(--border-default)]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}
        >
          <FileText size={16} style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-[var(--text-primary)] truncate">{template.name}</div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${color}15`, color }}
            >
              <Tag size={8} className="inline mr-1" />
              {template.category}
            </span>
            <span className="text-[10px] text-[var(--text-tertiary)]">
              {template.fields.length} fields
            </span>
          </div>
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-[var(--text-tertiary)]">
            <Calendar size={10} />
            {template.sections.length} sections
          </div>
        </div>
      </div>
      {template.confidence < 0.5 && (
        <div className="mt-2 text-[10px] text-[var(--warning)]">
          Low confidence analysis ({Math.round(template.confidence * 100)}%)
        </div>
      )}
    </button>
  )
}
