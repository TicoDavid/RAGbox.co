'use client'

import { SECURITY_TIERS, type SecurityTier } from './SecurityTiers'

interface SecurityBadgeProps {
  security: SecurityTier
  size?: 'normal' | 'large'
  showPulse?: boolean
}

export function SecurityBadge({ security, size = 'normal', showPulse = true }: SecurityBadgeProps) {
  const config = SECURITY_TIERS[security]
  const Icon = config.icon
  const isSovereign = security === 'sovereign'

  if (size === 'large') {
    return (
      <div className={`
        relative flex items-center gap-2 px-4 py-2.5 rounded-lg
        ${config.bg} border ${config.border} backdrop-blur-sm
        ${isSovereign && config.glow ? config.glow : ''}
      `}>
        {isSovereign && showPulse && (
          <div className="absolute inset-0 rounded-lg bg-[var(--danger)]/20 animate-pulse" />
        )}
        <Icon className={`relative w-5 h-5 ${config.color}`} />
        <div className="relative">
          <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">{config.description}</p>
        </div>
      </div>
    )
  }

  return (
    <span className={`
      relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium
      ${config.color} ${config.bg} border ${config.border} backdrop-blur-sm
      ${isSovereign && config.glow ? config.glow : ''}
    `}>
      {isSovereign && showPulse && (
        <span className="absolute inset-0 rounded-md bg-[var(--danger)]/20 animate-pulse" />
      )}
      <Icon className="relative w-3.5 h-3.5" />
      <span className="relative">{config.label}</span>
    </span>
  )
}
