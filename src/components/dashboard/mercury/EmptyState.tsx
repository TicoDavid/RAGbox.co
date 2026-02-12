'use client'

import React from 'react'
import Image from 'next/image'

export function EmptyState() {
  return (
    <div className="flex-1 relative overflow-hidden">
      {/* The Monolith — massive, silent, breathing */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <Image
          src="https://storage.googleapis.com/connexusai-assets/RAGb%C3%B6x_ICON.png"
          alt="RAGbox watermark"
          width={800}
          height={800}
          className="h-[55vh] w-auto opacity-25 select-none animate-[sanctuaryBreathe_10s_ease-in-out_infinite]"
          priority
          draggable={false}
        />
      </div>
    </div>
  )
}
