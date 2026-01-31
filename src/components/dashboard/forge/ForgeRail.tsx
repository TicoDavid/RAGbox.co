'use client'

import React from 'react'
import { Hammer, FileText } from 'lucide-react'
import { GeneratePopover } from './GeneratePopover'
import { AssetsPopover } from './AssetsPopover'

export function ForgeRail() {
  return (
    <div className="h-full flex flex-col items-center py-3 gap-1">
      {/* Generate */}
      <div className="group relative">
        <button
          className="w-10 h-10 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          title="Generate from Conversation"
        >
          <Hammer className="w-5 h-5" />
        </button>
        {/* Hover popover — appears to the left */}
        <div className="absolute right-full mr-2 top-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
          <GeneratePopover />
        </div>
      </div>

      {/* Assets */}
      <div className="group relative">
        <button
          className="w-10 h-10 flex items-center justify-center rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          title="Recent Assets"
        >
          <FileText className="w-5 h-5" />
        </button>
        {/* Hover popover — appears to the left */}
        <div className="absolute right-full mr-2 top-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
          <AssetsPopover />
        </div>
      </div>
    </div>
  )
}
