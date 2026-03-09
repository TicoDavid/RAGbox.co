'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Home, ChevronRight, MoreHorizontal } from 'lucide-react'

export interface BreadcrumbSegment {
  id: string
  label: string
}

interface VaultBreadcrumbProps {
  segments: BreadcrumbSegment[]
  onNavigate: (path: string[]) => void
  maxVisible?: number
}

export function VaultBreadcrumb({ segments, onNavigate, maxVisible = 4 }: VaultBreadcrumbProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showDropdown])

  // Build path up to a given segment index
  const navigateToIndex = (index: number) => {
    if (index < 0) {
      onNavigate([])
      return
    }
    const path = segments.slice(0, index + 1).map((s) => s.id)
    onNavigate(path)
  }

  // Determine which segments to show vs hide
  const allSegments = segments
  const needsTruncation = allSegments.length > maxVisible
  const hiddenSegments = needsTruncation ? allSegments.slice(0, allSegments.length - (maxVisible - 1)) : []
  const visibleSegments = needsTruncation ? allSegments.slice(allSegments.length - (maxVisible - 1)) : allSegments

  return (
    <nav
      className="flex items-center gap-1 px-4 py-2 text-sm bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]"
      aria-label="Vault breadcrumb"
      style={{ fontFamily: 'var(--font-jakarta)' }}
    >
      {/* Root segment — always visible */}
      <motion.button
        layoutId="breadcrumb-root"
        onClick={() => navigateToIndex(-1)}
        className={`flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1 transition-colors ${
          allSegments.length === 0
            ? 'text-[var(--text-primary)] font-semibold'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer'
        }`}
        aria-current={allSegments.length === 0 ? 'page' : undefined}
      >
        <Home className="w-3.5 h-3.5" />
        <span>Vault</span>
      </motion.button>

      {/* Ellipsis dropdown for truncated segments */}
      {needsTruncation && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown((v) => !v)}
              className="rounded-[var(--radius-sm)] px-2 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              aria-label="Show hidden path segments"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {showDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-1 z-50 min-w-[160px] bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[var(--radius-md)] shadow-lg py-1"
                >
                  {hiddenSegments.map((seg, i) => (
                    <button
                      key={seg.id}
                      onClick={() => {
                        navigateToIndex(i)
                        setShowDropdown(false)
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      {seg.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Visible segments */}
      <AnimatePresence mode="popLayout">
        {visibleSegments.map((seg, i) => {
          const isLast = i === visibleSegments.length - 1
          const globalIndex = needsTruncation
            ? allSegments.length - (maxVisible - 1) + i
            : i

          return (
            <React.Fragment key={seg.id}>
              <ChevronRight className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
              <motion.button
                layoutId={`breadcrumb-${seg.id}`}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                onClick={isLast ? undefined : () => navigateToIndex(globalIndex)}
                disabled={isLast}
                className={`rounded-[var(--radius-sm)] px-2 py-1 transition-colors truncate max-w-[160px] ${
                  isLast
                    ? 'text-[var(--text-primary)] font-semibold cursor-default'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer'
                }`}
                aria-current={isLast ? 'page' : undefined}
              >
                {seg.label}
              </motion.button>
            </React.Fragment>
          )
        })}
      </AnimatePresence>
    </nav>
  )
}
