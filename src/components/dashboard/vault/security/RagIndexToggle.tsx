'use client'

import { motion } from 'framer-motion'
import { Brain, BrainCog, ShieldAlert } from 'lucide-react'

interface RagIndexToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
}

export function RagIndexToggle({ enabled, onChange }: RagIndexToggleProps) {
  return (
    <div className={`
      p-4 rounded-xl border transition-all
      ${enabled
        ? 'bg-blue-500/5 border-blue-500/20'
        : 'bg-red-500/5 border-red-500/20'
      }
    `}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {enabled ? (
            <Brain className="w-5 h-5 text-blue-400" />
          ) : (
            <BrainCog className="w-5 h-5 text-red-400" />
          )}
          <span className={`text-sm font-semibold ${enabled ? 'text-blue-400' : 'text-red-400'}`}>
            {enabled ? 'Indexed for RAG' : 'RAG Disabled'}
          </span>
        </div>

        <button
          onClick={() => onChange(!enabled)}
          className={`
            relative w-12 h-6 rounded-full transition-colors
            ${enabled ? 'bg-blue-500' : 'bg-slate-700'}
          `}
        >
          <motion.div
            className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-md"
            animate={{ left: enabled ? '28px' : '4px' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      <p className="text-xs text-slate-500">
        {enabled
          ? 'AI can see and cite this document in responses.'
          : 'Document is stored but AI cannot access or cite it.'
        }
      </p>

      {!enabled && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-400 uppercase tracking-wider font-semibold">
          <ShieldAlert className="w-3 h-3" />
          Vector Database Excluded
        </div>
      )}
    </div>
  )
}
