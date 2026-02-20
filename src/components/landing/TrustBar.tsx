// THEME-EXEMPT: Public landing page, locked to Cobalt palette
'use client'

import React from 'react'

const TRUST_ITEMS = [
  { label: 'SOC 2 Ready', icon: '🛡️' },
  { label: 'HIPAA Compliant', icon: '🏥' },
  { label: 'AES-256-GCM', icon: '🔐' },
  { label: 'SEC 17a-4 Audit Trail', icon: '📊' },
  { label: 'Zero Data Retention', icon: '🚫' },
]

export function TrustBar() {
  return (
    <section className="py-16 border-t border-slate-800/50">
      <div className="max-w-5xl mx-auto px-6">
        <p className="text-center text-xs uppercase tracking-widest text-slate-500 mb-3">
          Enterprise-Grade Security
        </p>
        <p className="text-center text-sm text-slate-400 mb-8">
          Your data never leaves your vault.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-10">
          {TRUST_ITEMS.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 text-sm text-slate-400"
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
