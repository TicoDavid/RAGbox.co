import { Globe, Building, Lock, ShieldOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type SecurityTier = 'general' | 'internal' | 'confidential' | 'sovereign'

export interface TierConfig {
  level: number
  label: string
  description: string
  icon: LucideIcon
  color: string
  bg: string
  border: string
  glow?: string
}

export const SECURITY_TIERS: Record<SecurityTier, TierConfig> = {
  general: {
    level: 1,
    label: 'General',
    description: 'Public knowledge, Marketing materials',
    icon: Globe,
    color: 'text-[var(--success)]',
    bg: 'bg-[var(--success)]/10',
    border: 'border-[var(--success)]/20',
  },
  internal: {
    level: 2,
    label: 'Internal',
    description: 'Standard operational docs',
    icon: Building,
    color: 'text-[var(--brand-blue)]',
    bg: 'bg-[var(--brand-blue)]/10',
    border: 'border-[var(--brand-blue)]/20',
  },
  confidential: {
    level: 3,
    label: 'Confidential',
    description: 'Client contracts, Financial drafts',
    icon: Lock,
    color: 'text-[var(--warning)]',
    bg: 'bg-[var(--warning)]/10',
    border: 'border-[var(--warning)]/20',
  },
  sovereign: {
    level: 4,
    label: 'Sovereign',
    description: 'Eyes Only - Air-Gapped by default',
    icon: ShieldOff,
    color: 'text-[var(--danger)]',
    bg: 'bg-[var(--danger)]/10',
    border: 'border-[var(--danger)]/20',
    glow: 'shadow-[0_0_15px_rgba(239,68,68,0.3)]',
  },
}

export function tierToSecurity(tier: number): SecurityTier {
  switch (tier) {
    case 1: return 'general'
    case 2: return 'internal'
    case 3: return 'confidential'
    case 4: return 'sovereign'
    default: return 'general'
  }
}
