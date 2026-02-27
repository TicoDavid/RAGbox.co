'use client'

import { useState } from 'react'
import { Library, Plus } from 'lucide-react'
import TemplateCard from './TemplateCard'
import type { TemplateAnalysis } from '@/types/templateAnalysis'

/**
 * Static template definitions matching the Go backend's supported templates.
 * See backend/internal/service/forge.go for the canonical template IDs:
 *   - executive_brief
 *   - risk_assessment
 *   - compliance_summary
 */
const BUILT_IN_TEMPLATES: TemplateAnalysis[] = [
  {
    templateId: 'executive_brief',
    name: 'Executive Brief',
    category: 'general',
    sections: [
      { name: 'Executive Summary', order: 1, content: 'High-level overview of key findings', fields: [] },
      { name: 'Key Findings', order: 2, content: 'Numbered list of important discoveries', fields: [] },
      { name: 'Recommendations', order: 3, content: 'Actionable recommendations based on analysis', fields: [] },
      { name: 'Conclusion', order: 4, content: 'Summary and next steps', fields: [] },
    ],
    fields: [
      { name: 'topic', type: 'text', required: true, placeholder: 'What should the brief cover?', description: 'Main topic or question for the executive brief' },
    ],
    structure: { pageCount: 2, hasHeader: true, hasFooter: true, hasSignatureBlock: false, layout: 'standard' },
    confidence: 1.0,
  },
  {
    templateId: 'risk_assessment',
    name: 'Risk Assessment',
    category: 'financial',
    sections: [
      { name: 'Risk Overview', order: 1, content: 'Summary of identified risks', fields: [] },
      { name: 'Risk Matrix', order: 2, content: 'Categorized risk levels: High, Medium, Low', fields: [] },
      { name: 'Detailed Findings', order: 3, content: 'In-depth analysis of each risk area', fields: [] },
      { name: 'Mitigation Strategies', order: 4, content: 'Recommended actions to reduce risk', fields: [] },
      { name: 'Timeline', order: 5, content: 'Implementation schedule for mitigations', fields: [] },
    ],
    fields: [
      { name: 'topic', type: 'text', required: true, placeholder: 'What area should be assessed for risk?', description: 'Subject area for risk assessment' },
    ],
    structure: { pageCount: 3, hasHeader: true, hasFooter: true, hasSignatureBlock: false, layout: 'financial' },
    confidence: 1.0,
  },
  {
    templateId: 'compliance_summary',
    name: 'Compliance Summary',
    category: 'legal',
    sections: [
      { name: 'Compliance Status Overview', order: 1, content: 'Current compliance posture', fields: [] },
      { name: 'Requirements Checklist', order: 2, content: 'Regulatory requirements and their status', fields: [] },
      { name: 'Gap Analysis', order: 3, content: 'Identified gaps between current state and requirements', fields: [] },
      { name: 'Action Items', order: 4, content: 'Steps to achieve full compliance', fields: [] },
      { name: 'Attestation', order: 5, content: 'Formal attestation section', fields: [] },
    ],
    fields: [
      { name: 'topic', type: 'text', required: true, placeholder: 'Which compliance area or regulation?', description: 'Regulatory framework or compliance area to review' },
    ],
    structure: { pageCount: 3, hasHeader: true, hasFooter: true, hasSignatureBlock: true, layout: 'legal' },
    confidence: 1.0,
  },
]

interface TemplateLibraryProps {
  onSelect: (template: TemplateAnalysis) => void
  selectedTemplateId?: string
  onUploadClick: () => void
}

export default function TemplateLibrary({ onSelect, selectedTemplateId, onUploadClick }: TemplateLibraryProps) {
  const [filter, setFilter] = useState<string>('all')

  const templates = BUILT_IN_TEMPLATES
  const categories = ['all', ...Array.from(new Set(templates.map(t => t.category)))]
  const filtered = filter === 'all' ? templates : templates.filter(t => t.category === filter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Library size={16} className="text-[var(--brand-blue)]" />
          <span className="text-sm font-medium text-[var(--text-primary)]">Template Library</span>
          <span className="text-[10px] text-[var(--text-tertiary)]">({templates.length})</span>
        </div>
        <button
          onClick={onUploadClick}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-[var(--text-tertiary)] border border-[var(--bg-elevated)] cursor-not-allowed opacity-60"
          title="Custom template upload coming soon"
          disabled
        >
          <Plus size={12} />
          Upload
          <span className="ml-1 text-[8px] text-[var(--text-tertiary)]">Soon</span>
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
                  ? 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)] border border-[var(--brand-blue)]/30'
                  : 'bg-[var(--bg-primary)] text-[var(--text-tertiary)] border border-[var(--bg-tertiary)] hover:border-[var(--border-default)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Template List */}
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
    </div>
  )
}
