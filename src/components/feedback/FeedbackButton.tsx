'use client'

import { useState } from 'react'
import { MessageSquarePlus, X, Send, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useFeedbackStore } from '@/stores/feedbackStore'
import type { FeedbackType, FeedbackSeverity, FeedbackModule, FeedbackFormData } from '@/stores/feedbackStore'

const TYPES: FeedbackType[] = ['Bug', 'Feature', 'Question', 'Observation']
const SEVERITIES: FeedbackSeverity[] = ['Critical', 'High', 'Medium', 'Low']
const MODULES: FeedbackModule[] = ['Vault', 'Mercury', 'Studio', 'Airlock', 'Audit', 'Settings', 'Other']

const SEVERITY_COLORS: Record<FeedbackSeverity, string> = {
  Critical: 'bg-[var(--danger)]/20 text-[var(--danger)] border-[var(--danger)]/30',
  High: 'bg-[var(--warning)]/20 text-[var(--warning)] border-[var(--warning)]/30',
  Medium: 'bg-[var(--brand-blue)]/20 text-[var(--brand-blue)] border-[var(--brand-blue)]/30',
  Low: 'bg-[var(--success)]/20 text-[var(--success)] border-[var(--success)]/30',
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  colorMap,
}: {
  label: string
  value: T
  options: T[]
  onChange: (v: T) => void
  colorMap?: Record<string, string>
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-1.5">
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
              value === opt
                ? colorMap?.[opt] ?? 'bg-[var(--brand-blue)]/20 text-[var(--brand-blue)] border-[var(--brand-blue)]/30'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:border-[var(--brand-blue)]/30'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export function FeedbackButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState<FeedbackFormData>({
    type: 'Bug',
    severity: 'Medium',
    module: 'Other',
    description: '',
  })
  const submitFeedback = useFeedbackStore((s) => s.submitFeedback)
  const isSubmitting = useFeedbackStore((s) => s.isSubmitting)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.description.trim()) return
    await submitFeedback(formData)
    setFormData({ type: 'Bug', severity: 'Medium', module: 'Other', description: '' })
    setIsOpen(false)
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[90] flex items-center gap-2 px-4 py-2.5 rounded-full bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white text-sm font-medium shadow-lg shadow-[var(--brand-blue)]/25 transition-all hover:scale-105"
        title="Send feedback"
      >
        <MessageSquarePlus className="w-4 h-4" />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {/* Feedback form modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed bottom-20 right-6 z-[101] w-[400px] max-h-[80vh] overflow-y-auto rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-default)] shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-default)]">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Beta Feedback
                  </h3>
                  <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">
                    Help us improve RAGbox
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <SelectField label="Type" value={formData.type} options={TYPES} onChange={(v) => setFormData({ ...formData, type: v })} />

                <SelectField
                  label="Severity"
                  value={formData.severity}
                  options={SEVERITIES}
                  onChange={(v) => setFormData({ ...formData, severity: v })}
                  colorMap={SEVERITY_COLORS}
                />

                <SelectField label="Module" value={formData.module} options={MODULES} onChange={(v) => setFormData({ ...formData, module: v })} />

                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] font-semibold mb-1.5">
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the issue, suggestion, or question..."
                    rows={4}
                    required
                    className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--brand-blue)] focus:ring-1 focus:ring-[var(--brand-blue)]/30 resize-none transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!formData.description.trim() || isSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit Feedback
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
