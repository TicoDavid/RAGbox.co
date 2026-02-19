'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { HelpCircle } from 'lucide-react'

interface HelpTooltipProps {
  content: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

export function HelpTooltip({ content, position = 'top', className = '' }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const show = useCallback(() => {
    if (timeoutRef.current !== undefined) clearTimeout(timeoutRef.current)
    setVisible(true)
  }, [])

  const hide = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(false), 150)
  }, [])

  useEffect(() => () => {
    if (timeoutRef.current !== undefined) clearTimeout(timeoutRef.current)
  }, [])

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <span className={`relative inline-flex ${className}`} onMouseEnter={show} onMouseLeave={hide}>
      <HelpCircle className="w-3.5 h-3.5 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-help" />
      {visible && (
        <span
          className={`absolute z-50 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-xs text-[var(--text-primary)] whitespace-normal max-w-[220px] shadow-xl ${positionClasses[position]}`}
          role="tooltip"
        >
          {content}
        </span>
      )}
    </span>
  )
}
