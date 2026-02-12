'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'
import { SECURITY_TIERS, type SecurityTier } from './SecurityTiers'

interface SecurityDropdownProps {
  value: SecurityTier
  onChange: (tier: SecurityTier) => void
}

export function SecurityDropdown({ value, onChange }: SecurityDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const config = SECURITY_TIERS[value]
  const Icon = config.icon

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between gap-2 px-4 py-3 rounded-lg
          ${config.bg} border ${config.border} backdrop-blur-sm
          hover:bg-opacity-80 transition-all cursor-pointer
          ${value === 'sovereign' ? config.glow : ''}
        `}
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${config.color}`} />
          <div className="text-left">
            <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
            <p className="text-[10px] text-slate-500">{config.description}</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 ${config.color} transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-2 left-0 right-0 z-50
                       bg-[#0A192F]/95 backdrop-blur-xl border border-white/10
                       rounded-xl overflow-hidden shadow-xl"
          >
            {(Object.entries(SECURITY_TIERS) as [SecurityTier, typeof SECURITY_TIERS[SecurityTier]][]).map(([key, tier]) => {
              const TierIcon = tier.icon
              const isSelected = key === value
              return (
                <button
                  key={key}
                  onClick={() => { onChange(key); setIsOpen(false) }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 text-left transition-all
                    ${isSelected ? tier.bg : 'hover:bg-white/5'}
                  `}
                >
                  <TierIcon className={`w-5 h-5 ${tier.color}`} />
                  <div className="flex-1">
                    <span className={`text-sm font-medium ${tier.color}`}>{tier.label}</span>
                    <p className="text-[10px] text-slate-500">{tier.description}</p>
                  </div>
                  {isSelected && <Check className={`w-4 h-4 ${tier.color}`} />}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
