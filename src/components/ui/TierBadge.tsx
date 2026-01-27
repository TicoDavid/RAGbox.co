'use client'

import { getTierConfig } from '@/lib/security/tiers'

interface TierBadgeProps {
  tier: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export default function TierBadge({ tier, size = 'sm', showLabel = true }: TierBadgeProps) {
  const config = getTierConfig(tier)

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
    lg: 'text-sm px-2.5 py-1',
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]}`}
      style={{
        backgroundColor: `${config.color}15`,
        color: config.color,
        border: `1px solid ${config.color}40`,
        boxShadow: tier >= 3 ? `0 0 8px ${config.glowColor}` : undefined,
      }}
      title={config.description}
    >
      <TierDot color={config.color} glow={tier >= 4} />
      {showLabel && <span>T{tier}</span>}
    </span>
  )
}

function TierDot({ color, glow }: { color: string; glow: boolean }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full"
      style={{
        backgroundColor: color,
        boxShadow: glow ? `0 0 6px ${color}` : undefined,
      }}
    />
  )
}
