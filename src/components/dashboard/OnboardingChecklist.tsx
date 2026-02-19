'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, Circle, Upload, MessageSquare, Shield, Sparkles } from 'lucide-react'
import { useVaultStore } from '@/stores/vaultStore'
import { useMercuryStore } from '@/stores/mercuryStore'

const ONBOARDING_KEY = 'ragbox-onboarding-dismissed'

interface Step {
  id: string
  label: string
  description: string
  icon: React.ElementType
  check: () => boolean
}

export function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(true) // hidden by default until checked
  const [visible, setVisible] = useState(false)
  const documents = useVaultStore((s) => s.documents)
  const messages = useMercuryStore((s) => s.messages)

  useEffect(() => {
    const wasDismissed = localStorage.getItem(ONBOARDING_KEY) === 'true'
    setDismissed(wasDismissed)
    if (!wasDismissed) {
      // Small delay so dashboard renders first
      const timer = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    setTimeout(() => {
      setDismissed(true)
      localStorage.setItem(ONBOARDING_KEY, 'true')
    }, 300)
  }, [])

  const steps: Step[] = [
    {
      id: 'upload',
      label: 'Upload your first document',
      description: 'Drag and drop a PDF, DOCX, or TXT into the Vault panel on the left.',
      icon: Upload,
      check: () => Object.keys(documents).length > 0,
    },
    {
      id: 'query',
      label: 'Ask Mercury a question',
      description: 'Type a question in the chat bar about your uploaded documents.',
      icon: MessageSquare,
      check: () => messages.filter((m) => m.role === 'user').length > 0,
    },
    {
      id: 'citations',
      label: 'Review cited sources',
      description: 'Click on a citation number [1] in Mercury\'s response to see the source.',
      icon: Sparkles,
      check: () => messages.some((m) => m.citations && m.citations.length > 0),
    },
    {
      id: 'privilege',
      label: 'Explore Privilege Mode',
      description: 'Toggle the shield icon to protect sensitive documents.',
      icon: Shield,
      check: () => false, // Manual discovery
    },
  ]

  const completedCount = steps.filter((s) => s.check()).length
  const allDone = completedCount === steps.length

  if (dismissed) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-6 right-6 z-50 w-80 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Getting Started</h3>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">{completedCount}/{steps.length} complete</p>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 rounded-md hover:bg-[var(--bg-elevated)] transition-colors"
              aria-label="Dismiss onboarding"
            >
              <X className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-[var(--bg-tertiary)]">
            <motion.div
              className="h-full bg-[var(--brand-blue)]"
              initial={{ width: 0 }}
              animate={{ width: `${(completedCount / steps.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>

          {/* Steps */}
          <div className="p-3 space-y-1">
            {steps.map((step) => {
              const done = step.check()
              return (
                <div
                  key={step.id}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    done ? 'bg-[var(--success)]/5' : 'hover:bg-[var(--bg-elevated)]/50'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="w-4 h-4 text-[var(--success)] mt-0.5 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-[var(--text-tertiary)] mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className={`text-xs font-medium ${done ? 'text-[var(--success)] line-through' : 'text-[var(--text-primary)]'}`}>
                      {step.label}
                    </p>
                    {!done && (
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{step.description}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Completion state */}
          {allDone && (
            <div className="px-4 py-3 bg-[var(--success)]/10 border-t border-[var(--success)]/20 text-center">
              <p className="text-xs text-[var(--success)] font-medium">You're all set! Welcome to RAGbox.</p>
              <button
                onClick={handleDismiss}
                className="mt-1.5 text-[10px] text-[var(--success)]/70 underline hover:text-[var(--success)]"
              >
                Dismiss
              </button>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
