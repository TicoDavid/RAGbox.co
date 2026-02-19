'use client'

import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface MercuryConfigModalProps {
  isOpen: boolean
  onClose: () => void
}

export function MercuryConfigModal({ isOpen, onClose }: MercuryConfigModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">
                  Mercury Configuration
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close configuration"
                  className="w-8 h-8 flex items-center justify-center rounded-lg
                             text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]
                             transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body — placeholder for Sheldon */}
              <div className="px-6 py-12 text-center">
                <p className="text-sm text-[var(--text-tertiary)]">
                  Configuration sections coming soon.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
