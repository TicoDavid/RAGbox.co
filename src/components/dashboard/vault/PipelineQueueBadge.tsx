'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Clock } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface PipelineQueueBadgeProps {
  activeCount?: number
  queuedCount?: number
}

export function PipelineQueueBadge({ activeCount: propActive, queuedCount: propQueued }: PipelineQueueBadgeProps) {
  const [active, setActive] = useState(propActive ?? 0)
  const [queued, setQueued] = useState(propQueued ?? 0)

  useEffect(() => {
    if (propActive !== undefined) setActive(propActive)
    if (propQueued !== undefined) setQueued(propQueued)
  }, [propActive, propQueued])

  // Poll queue status every 10s, stop when idle
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null

    const poll = async () => {
      try {
        const res = await apiFetch('/api/pipeline/queue-status')
        if (res.ok) {
          const data = await res.json()
          setActive(data.activeCount ?? 0)
          setQueued(data.queuedCount ?? 0)

          // Stop polling when both are 0
          if ((data.activeCount ?? 0) === 0 && (data.queuedCount ?? 0) === 0 && interval) {
            clearInterval(interval)
            interval = null
          }
        }
      } catch {
        // Silently retry
      }
    }

    // Start polling
    poll()
    interval = setInterval(poll, 10000)
    return () => { if (interval) clearInterval(interval) }
  }, [])

  const isVisible = active > 0 || queued > 0

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-1.5 text-xs"
        >
          {active > 0 && (
            <span className="flex items-center gap-1 text-[var(--brand-blue)]">
              <Loader2 className="w-3 h-3 animate-spin" />
              {active}
            </span>
          )}
          {active > 0 && queued > 0 && (
            <span className="text-[var(--border-default)]">|</span>
          )}
          {queued > 0 && (
            <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
              <Clock className="w-3 h-3" />
              {queued}
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
