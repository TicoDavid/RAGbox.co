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
          <FileText size={16} className="text-[#2463EB]" />
          <span className="text-sm font-medium text-white">{template.name}</span>
        </div>
        <div className="text-[10px] text-[#666]">
          {filledCount}/{template.fields.length} fields filled
          {requiredCount > 0 && (
            <span className={requiredFilled === requiredCount ? 'text-green-500' : 'text-[#FFAB00]'}>
              {' '}({requiredFilled}/{requiredCount} required)
            </span>
          )}
        </div>
      </div>

      {/* Confidence */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-[#222] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${template.confidence * 100}%`,
              backgroundColor: template.confidence >= 0.7 ? '#2463EB' : '#FFAB00',
            }}
          />
        </div>
        <span className="text-[10px] text-[#666]">
          {Math.round(template.confidence * 100)}% confidence
        </span>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {template.sections.map((section, i) => (
          <div key={i} className="rounded-lg border border-[#222] bg-[#0a0a0a]">
            <button
              onClick={() => toggleSection(i)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left"
            >
              {expandedSections.has(i) ? (
                <ChevronDown size={14} className="text-[#666]" />
              ) : (
                <ChevronRight size={14} className="text-[#666]" />
              )}
              <span className="text-xs font-medium text-white">{section.name}</span>
            </button>
            {expandedSections.has(i) && (
              <div className="px-3 pb-3 text-[10px] text-[#888]">
                {section.content}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Fields */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-white">Fields</div>
        {template.fields.map(field => (
          <div key={field.name} className="space-y-1">
            <label className="flex items-center gap-1.5 text-[10px]">
              {fieldValues[field.name]?.trim() ? (
                <CheckCircle2 size={12} className="text-green-500" />
              ) : (
                <Circle size={12} className={field.required ? 'text-[#FFAB00]' : 'text-[#444]'} />
              )}
              <span className="text-white">
                {field.name}
                {field.required && <span className="text-[#FFAB00] ml-0.5">*</span>}
              </span>
              <span className="text-[#555]">({field.type})</span>
            </label>
            {field.description && (
              <div className="text-[10px] text-[#555] ml-5">{field.description}</div>
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
                className="w-full ml-5 px-2 py-1.5 rounded bg-[#111] border border-[#333] text-xs text-white placeholder-[#555] focus:outline-none focus:border-[#2463EB] transition-colors"
                style={{ width: 'calc(100% - 20px)' }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
