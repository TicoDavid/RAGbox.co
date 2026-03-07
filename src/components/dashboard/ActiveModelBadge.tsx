'use client'

import { useSettings } from '@/contexts/SettingsContext'

export function ActiveModelBadge() {
  const { isAegisActive } = useSettings()

  const isNative = isAegisActive

  return (
    <div className={`
      flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors
      ${isNative
        ? 'bg-gradient-to-r from-[var(--warning)]/10 to-[var(--warning)]/5 border border-[var(--warning)]/30'
        : 'bg-gradient-to-r from-[var(--brand-blue)]/10 to-[var(--brand-blue-dim)]/10 border border-[var(--brand-blue)]/30'
      }
    `}>
      {isNative ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--warning)]">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[var(--brand-blue)]">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      )}
      <span className={`text-xs font-medium ${isNative ? 'text-[var(--warning)]' : 'text-[var(--brand-blue)]'}`}>
        M.E.R.C.U.R.Y.
      </span>
    </div>
  )
}
