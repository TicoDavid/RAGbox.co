'use client'

import { useState } from 'react'
import { Hammer } from 'lucide-react'
import TemplateSelector from './TemplateSelector'

interface StudioButtonProps {
  responseText: string
  className?: string
}

export default function StudioButton({ responseText, className }: StudioButtonProps) {
  const [showSelector, setShowSelector] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowSelector(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium text-[var(--brand-blue)] border border-[var(--brand-blue)]/30 hover:bg-[var(--brand-blue)]/10 transition-colors ${className || ''}`}
        title="Generate document in Sovereign Studio"
      >
        <Hammer size={12} />
        Studio
      </button>

      {showSelector && (
        <TemplateSelector
          sourceContext={responseText}
          onClose={() => setShowSelector(false)}
        />
      )}
    </>
  )
}
