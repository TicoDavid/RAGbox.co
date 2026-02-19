'use client'

import { useState } from 'react'
import { X, ArrowUp, ArrowDown, Shield } from 'lucide-react'
import { getTierConfig, canPromote, canDemote } from '@/lib/security/tiers'
import TierBadge from './TierBadge'

interface TierPromotionDialogProps {
  documentId: string
  documentName: string
  currentTier: number
  isOpen: boolean
  onClose: () => void
  onConfirm: (targetTier: number) => void
}

export default function TierPromotionDialog({
  documentName,
  currentTier,
  isOpen,
  onClose,
  onConfirm,
}: TierPromotionDialogProps) {
  const [selectedTier, setSelectedTier] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)

  if (!isOpen) return null

  const promotionOptions = [0, 1, 2, 3, 4].filter(
    t => t !== currentTier && (canPromote(currentTier, t) || canDemote(currentTier, t))
  )

  const handleConfirm = async () => {
    if (selectedTier === null) return
    setConfirming(true)
    onConfirm(selectedTier)
    setConfirming(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-[var(--border-default)] bg-[var(--bg-primary)] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-[var(--brand-blue)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Change Security Tier</h3>
          </div>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
            <X size={16} />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-xs text-[var(--text-tertiary)] mb-2">Document: <span className="text-[var(--text-primary)]">{documentName}</span></p>
          <p className="text-xs text-[var(--text-tertiary)]">
            Current tier: <TierBadge tier={currentTier} size="md" />
          </p>
        </div>

        <div className="space-y-2 mb-6">
          {promotionOptions.map(tier => {
            const config = getTierConfig(tier)
            const isPromotion = tier > currentTier

            return (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                  selectedTier === tier
                    ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10'
                    : 'border-[var(--bg-tertiary)] bg-[var(--bg-primary)] hover:border-[var(--border-default)]'
                }`}
              >
                {isPromotion ? (
                  <ArrowUp size={14} className="text-[var(--success)]" />
                ) : (
                  <ArrowDown size={14} className="text-[var(--warning)]" />
                )}
                <TierBadge tier={tier} size="md" />
                <div className="flex-1">
                  <div className="text-xs text-[var(--text-primary)]">{config.label}</div>
                  <div className="text-[10px] text-[var(--text-tertiary)]">{config.description}</div>
                </div>
              </button>
            )
          })}

          {promotionOptions.length === 0 && (
            <p className="text-xs text-[var(--text-tertiary)] text-center py-4">
              No tier changes available for this document.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 rounded-lg text-xs text-[var(--text-tertiary)] border border-[var(--border-default)] hover:border-[var(--border-strong)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedTier === null || confirming}
            className="flex-1 px-3 py-2 rounded-lg text-xs font-medium text-black bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {confirming ? 'Updating...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
