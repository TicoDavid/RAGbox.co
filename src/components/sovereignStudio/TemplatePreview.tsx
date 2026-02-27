'use client'

import { useState } from 'react'
import { FileText, ChevronDown, ChevronRight, CheckCircle2, Circle } from 'lucide-react'
import type { TemplateAnalysis, TemplateField } from '@/types/templateAnalysis'

interface TemplatePreviewProps {
  template: TemplateAnalysis
  fieldValues: Record<string, string>
  onFieldChange: (fieldName: string, value: string) => void
}

const fieldTypeInputs: Record<TemplateField['type'], string> = {
  text: 'text',
  date: 'date',
  number: 'number',
  list: 'text',
  signature: 'text',
  checkbox: 'checkbox',
}

export default function TemplatePreview({ template, fieldValues, onFieldChange }: TemplatePreviewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    new Set(template.sections.map((_, i) => i))
  )

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  const filledCount = template.fields.filter(f => fieldValues[f.name]?.trim()).length
  const requiredCount = template.fields.filter(f => f.required).length
  const requiredFilled = template.fields.filter(f => f.required && fieldValues[f.name]?.trim()).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-[var(--brand-blue)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">{template.name}</span>
        </div>
        <div className="text-[10px] text-[var(--text-tertiary)]">
          {filledCount}/{template.fields.length} fields filled
          {requiredCount > 0 && (
            <span className={requiredFilled === requiredCount ? 'text-[var(--success)]' : 'text-[var(--warning)]'}>
              {' '}({requiredFilled}/{requiredCount} required)
            </span>
          )}
        </div>
      </div>

      {/* Confidence */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${template.confidence * 100}%`,
              backgroundColor: template.confidence >= 0.7 ? 'var(--brand-blue)' : 'var(--warning)',
            }}
          />
        </div>
        <span className="text-[10px] text-[var(--text-tertiary)]">
          {Math.round(template.confidence * 100)}% confidence
        </span>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {template.sections.map((section, i) => (
          <div key={i} className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)]">
            <button
              onClick={() => toggleSection(i)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left"
            >
              {expandedSections.has(i) ? (
                <ChevronDown size={14} className="text-[var(--text-tertiary)]" />
              ) : (
                <ChevronRight size={14} className="text-[var(--text-tertiary)]" />
              )}
              <span className="text-xs font-medium text-[var(--text-primary)]">{section.name}</span>
            </button>
            {expandedSections.has(i) && (
              <div className="px-3 pb-3 text-[10px] text-[var(--text-secondary)]">
                {section.content}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Fields */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-[var(--text-primary)]">Fields</div>
        {template.fields.map(field => (
          <div key={field.name} className="space-y-1">
            <label className="flex items-center gap-1.5 text-[10px]">
              {fieldValues[field.name]?.trim() ? (
                <CheckCircle2 size={12} className="text-[var(--success)]" />
              ) : (
                <Circle size={12} className={field.required ? 'text-[var(--warning)]' : 'text-[var(--border-default)]'} />
              )}
              <span className="text-[var(--text-primary)]">
                {field.name}
                {field.required && <span className="text-[var(--warning)] ml-0.5">*</span>}
              </span>
              <span className="text-[var(--text-tertiary)]">({field.type})</span>
            </label>
            {field.description && (
              <div className="text-[10px] text-[var(--text-tertiary)] ml-5">{field.description}</div>
            )}
            {field.type === 'checkbox' ? (
              <input
                type="checkbox"
                checked={fieldValues[field.name] === 'true'}
                onChange={e => onFieldChange(field.name, e.target.checked ? 'true' : 'false')}
                className="ml-5"
              />
            ) : (
              <input
                type={fieldTypeInputs[field.type]}
                value={fieldValues[field.name] || ''}
                onChange={e => onFieldChange(field.name, e.target.value)}
                placeholder={field.placeholder || field.defaultValue || `Enter ${field.name}`}
                className="w-full ml-5 px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--bg-elevated)] text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-blue)] transition-colors"
                style={{ width: 'calc(100% - 20px)' }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
