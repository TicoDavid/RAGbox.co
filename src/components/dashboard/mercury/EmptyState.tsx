'use client'

import React from 'react'
import { Search, FileText, Shield, Zap } from 'lucide-react'

const suggestions = [
  { icon: Search, text: 'Ask a question about your documents' },
  { icon: FileText, text: 'Summarize a recent upload' },
  { icon: Shield, text: 'Check compliance status' },
  { icon: Zap, text: 'Generate a report from vault data' },
]

export function EmptyState() {
  return (
    <div className="flex-1 relative overflow-hidden flex items-center justify-center">
      {/* Watermark shows through — this overlay is semi-transparent */}
      <div className="relative z-10 text-center max-w-md px-6">
        <h2 className="text-lg font-semibold text-white/90 mb-2">
          Welcome to M.E.R.C.U.R.Y.
        </h2>
        <p className="text-sm text-slate-400 mb-6">
          Your AI knowledge assistant. Ask anything about your uploaded documents
          and get verified, cited answers.
        </p>
        <div className="space-y-2">
          {suggestions.map((s) => (
            <div
              key={s.text}
              className="flex items-center gap-3 px-4 py-2.5 rounded-lg
                       bg-white/5 border border-white/5 text-sm text-slate-300"
            >
              <s.icon className="w-4 h-4 text-[var(--brand-blue)] shrink-0" />
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
