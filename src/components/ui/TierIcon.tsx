'use client'

import { Upload, FileText, Shield, Lock, ShieldAlert } from 'lucide-react'
import { getTierConfig } from '@/lib/security/tiers'

interface TierIconProps {
  tier: number
  size?: number
  className?: string
}

const TIER_ICONS = [Upload, FileText, Shield, Lock, ShieldAlert]

export default function TierIcon({ tier, size = 16, className }: TierIconProps) {
  const config = getTierConfig(tier)
  const Icon = TIER_ICONS[tier] || FileText

  return (
    <Icon
      size={size}
      className={className}
      style={{ color: config.color }}
    />
  )
}
