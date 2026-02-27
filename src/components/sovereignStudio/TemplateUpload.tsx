'use client'

import { Upload, Lock } from 'lucide-react'

interface TemplateUploadProps {
  onAnalysisComplete: (templateId: string) => void
}

/**
 * TemplateUpload - Currently disabled.
 *
 * Custom template upload requires a backend /api/templates/analyze endpoint
 * that does not exist yet. This component shows a "Coming Soon" placeholder
 * to keep the UI intact while the feature is unavailable.
 */
export default function TemplateUpload({ onAnalysisComplete: _onAnalysisComplete }: TemplateUploadProps) {
  return (
    <div className="space-y-3">
      <div
        className="relative border-2 border-dashed rounded-lg p-6 text-center border-[var(--bg-tertiary)] bg-[var(--bg-primary)] opacity-60"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="relative">
            <Upload size={24} className="text-[var(--border-default)]" />
            <Lock size={10} className="absolute -bottom-1 -right-1 text-[var(--text-tertiary)]" />
          </div>
          <div className="text-xs text-[var(--text-tertiary)]">Custom template upload</div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--bg-elevated)]">
            <span className="text-[10px] text-[var(--text-secondary)] font-medium">Coming Soon</span>
          </div>
          <div className="text-[10px] text-[var(--border-default)]">
            Use one of the built-in templates for now
          </div>
        </div>
      </div>
    </div>
  )
}
