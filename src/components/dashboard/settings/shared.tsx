'use client'

/**
 * Shared UI primitives for Settings panel sections.
 */

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-tertiary)]">
        {title}
      </h3>
      <p className="text-sm text-[var(--text-tertiary)] mt-1">{description}</p>
    </div>
  )
}

export function ToggleSetting({
  label,
  description,
  enabled,
  onToggle,
}: {
  label: string
  description: string
  enabled: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-[var(--bg-elevated)]/30 border border-[var(--border-default)] rounded-lg">
      <div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{label}</p>
        <p className="text-xs text-[var(--text-secondary)]">{description}</p>
      </div>
      <button
        onClick={onToggle}
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        className={`w-11 h-6 rounded-full transition-colors ${
          enabled ? 'bg-[var(--brand-blue)]' : 'bg-[var(--bg-tertiary)]'
        }`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
