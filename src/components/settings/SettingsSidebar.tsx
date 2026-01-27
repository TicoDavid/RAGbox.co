'use client'

import { User, Shield, HardDrive, Download } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard/settings', label: 'Profile', icon: User },
  { href: '/dashboard/settings/security', label: 'Security', icon: Shield },
  { href: '/dashboard/settings/vault', label: 'Vault', icon: HardDrive },
  { href: '/dashboard/settings/export', label: 'Export', icon: Download },
]

export default function SettingsSidebar() {
  const pathname = usePathname()

  return (
    <nav className="w-48 border-r border-[#222] py-4 space-y-1">
      <div className="px-4 mb-4">
        <h2 className="text-sm font-semibold text-white">Settings</h2>
      </div>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 px-4 py-2 text-xs transition-colors ${
              isActive
                ? 'text-[#00F0FF] bg-[#00F0FF]/10 border-r-2 border-[#00F0FF]'
                : 'text-[#888] hover:text-white hover:bg-[#111]'
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
