'use client'

/**
 * InsightsPanel — EPIC-028 Phase 4: Collapsible proactive insights section
 *
 * Positioned below the ContextBar, above the ConversationThread.
 * Shows up to 3 active insights as compact cards, with "Show more" overflow.
 * Hidden when no insights are available.
 */

import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { useMercuryStore } from '@/stores/mercuryStore'
import { InsightCard } from './InsightCard'

const MAX_VISIBLE = 3

export function InsightsPanel() {
  const insights = useMercuryStore((s) => s.insights)
  const acknowledgeInsight = useMercuryStore((s) => s.acknowledgeInsight)
  const [expanded, setExpanded] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const active = insights.filter((i) => !i.acknowledged)
  if (active.length === 0) return null

  const visible = showAll ? active : active.slice(0, MAX_VISIBLE)
  const hasMore = active.length > MAX_VISIBLE

  const handleNavigate = (documentId: string) => {
    window.dispatchEvent(
      new CustomEvent('mercury:open-document', { detail: { documentId } })
    )
  }

  return (
    <div className="shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/30 backdrop-blur-sm relative z-10">
      {/* Header — toggle collapse */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-[var(--bg-elevated)]/20 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[var(--warning)]" />
          <span className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Insights
          </span>
          <span className="text-[10px] font-medium text-[var(--text-tertiary)] bg-[var(--bg-elevated)] px-1.5 py-0.5 rounded-full">
            {active.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
        )}
      </button>

      {/* Cards */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 space-y-2">
              <AnimatePresence mode="popLayout">
                {visible.map((insight) => (
                  <motion.div
                    key={insight.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0 }}
                    transition={{ duration: 0.2 }}
                    layout
                  >
                    <InsightCard
                      insight={insight}
                      onAcknowledge={acknowledgeInsight}
                      onNavigate={handleNavigate}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Show more / Show less */}
              {hasMore && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="text-[10px] font-medium text-[var(--brand-blue)] hover:text-[var(--brand-blue-hover)] transition-colors pl-1"
                >
                  {showAll ? 'Show less' : `Show ${active.length - MAX_VISIBLE} more`}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
