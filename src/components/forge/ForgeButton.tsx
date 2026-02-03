'use client'

import { useState } from 'react'
import { Hammer } from 'lucide-react'
import TemplateSelector from './TemplateSelector'

interface ForgeButtonProps {
  responseText: string
  className?: string
}

export default function ForgeButton({ responseText, className }: ForgeButtonProps) {
  const [showSelector, setShowSelector] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowSelector(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium text-[#2463EB] border border-[#2463EB]/30 hover:bg-[#2463EB]/10 transition-colors ${className || ''}`}
        title="Forge Document from this response"
      >
        <Hammer size={12} />
        Forge
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
