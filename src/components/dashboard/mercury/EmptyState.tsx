'use client'

import React from 'react'

export function EmptyState() {
  return (
    <div className="flex-1 relative overflow-hidden">
      {/* Watermark is rendered by MercuryPanel (Layer 2) — nothing needed here */}
      {/* This empty state is intentionally transparent so the watermark shows through */}
    </div>
  )
}
