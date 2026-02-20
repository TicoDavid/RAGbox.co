'use client'

import { User, Shield, HardDrive, Download, MessageCircle, Bot, Brain } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard/settings', label: 'Profile', icon: User },
  { href: '/dashboard/settings/security', label: 'Security', icon: Shield },
  { href: '/dashboard/settings/vault', label: 'Vault', icon: HardDrive },
  { href: '/dashboard/settings/mercury', label: 'Mercury', icon: Bot },
  { href: '/dashboard/settings/personas', label: 'Personas', icon: Brain },
  { href: '/dashboard/settings/integrations', label: 'Integrations', icon: MessageCircle },
  { href: '/dashboard/settings/export', label: 'Export', icon: Download },
]

export default function SettingsSidebar() {
  const pathname = usePathname()

  return (
    <nav className="w-48 border-r border-[var(--border-default)] py-4 space-y-1">
      <div className="px-4 mb-4">
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">Settings</h2>
      </div>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 px-4 py-2 text-xs transition-colors ${
              isActive
                ? 'text-[var(--brand-blue)] bg-[var(--brand-blue)]/10 border-r-2 border-[var(--brand-blue)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
            }`}
          >
            <Icon size={14} />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
