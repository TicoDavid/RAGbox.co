'use client'

/**
 * FeedbackModal — User feedback submission
 *
 * Category (Bug / Feature / General) + message + optional screenshot.
 * Submits via feedbackStore → POST /api/feedback.
 */

import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { X, Camera, Loader2, Bug, Lightbulb, MessageCircle } from 'lucide-react'
import { useFeedbackStore } from '@/stores/feedbackStore'
import type { FeedbackType, FeedbackSeverity, FeedbackModule } from '@/stores/feedbackStore'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
}

const CATEGORIES = [
  { id: 'Bug' as FeedbackType, label: 'Bug', icon: Bug, color: 'text-[var(--danger)]' },
  { id: 'Feature' as FeedbackType, label: 'Feature Request', icon: Lightbulb, color: 'text-[var(--warning)]' },
  { id: 'Question' as FeedbackType, label: 'General', icon: MessageCircle, color: 'text-[var(--brand-blue)]' },
]

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const submitFeedback = useFeedbackStore((s) => s.submitFeedback)
  const isSubmitting = useFeedbackStore((s) => s.isSubmitting)

  const [category, setCategory] = useState<FeedbackType>('Bug')
  const [message, setMessage] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!message.trim() || message.trim().length < 10) return

    await submitFeedback({
      type: category,
      severity: 'Medium' as FeedbackSeverity,
      module: 'Other' as FeedbackModule,
      description: message.trim(),
      screenshot: screenshot ?? undefined,
    })

    // Reset and close
    setMessage('')
    setCategory('Bug')
    setScreenshot(null)
    onClose()
  }

  const handleScreenshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setScreenshot(file)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-[460px] rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-default)] shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <h2 id="feedback-title" className="text-base font-semibold text-[var(--text-primary)]">Send Feedback</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon
                const isActive = category === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border text-xs font-medium transition-all ${
                      isActive
                        ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]'
                        : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--brand-blue)]' : cat.color}`} />
                    {cat.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Message */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="feedback-message" className="text-xs font-medium text-[var(--text-secondary)]">
                Message
              </label>
              <span className={`text-[10px] ${message.length < 10 ? 'text-[var(--text-tertiary)]' : 'text-[var(--success)]'}`}>
                {message.length}/2000
              </span>
            </div>
            <textarea
              id="feedback-message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
              placeholder="Tell us what's on your mind..."
              rows={5}
              className="w-full px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-default)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-blue)] resize-y min-h-[120px]"
            />
          </div>

          {/* Screenshot */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleScreenshot}
              className="hidden"
              aria-label="Upload screenshot file"
            />
            {screenshot ? (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-default)]">
                <Camera className="w-4 h-4 text-[var(--brand-blue)] shrink-0" />
                <span className="text-xs text-[var(--text-primary)] truncate flex-1">{screenshot.name}</span>
                <button
                  onClick={() => setScreenshot(null)}
                  className="p-0.5 rounded text-[var(--text-tertiary)] hover:text-[var(--danger)] transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                Attach screenshot (optional)
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--border-subtle)]">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!message.trim() || message.trim().length < 10 || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors" /* THEME-EXEMPT: white on brand */
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Send Feedback
          </button>
        </div>
      </motion.div>
    </div>
  )
}
