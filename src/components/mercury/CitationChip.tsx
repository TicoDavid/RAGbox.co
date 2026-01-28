'use client'

import { useState } from 'react'

interface CitationChipProps {
  index: number
  documentName: string
  excerpt: string
  relevanceScore: number
  securityTier: number
  onClick?: () => void
}

export default function CitationChip({
  index,
  documentName,
  excerpt,
  relevanceScore,
  onClick,
}: CitationChipProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <span className="relative inline-block">
      <button
        className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 hover:bg-[#00F0FF]/25 transition-colors cursor-pointer"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={onClick}
        title={`${documentName} (${(relevanceScore * 100).toFixed(0)}% match)`}
      >
        {index}
      </button>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-72 p-3 rounded-lg bg-[#111] border border-[#333] shadow-xl">
          <div className="text-xs font-medium text-[#00F0FF] mb-1 truncate">{documentName}</div>
          <div className="text-[10px] text-[#888] line-clamp-3">{excerpt}</div>
          <div className="text-[10px] text-[#555] mt-1">
            {(relevanceScore * 100).toFixed(0)}% relevance
          </div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-[#111] border-r border-b border-[#333]" />
        </div>
      )}
    </span>
  )
}
