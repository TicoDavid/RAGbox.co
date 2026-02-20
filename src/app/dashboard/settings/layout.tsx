'use client'

import SettingsSidebar from '@/components/settings/SettingsSidebar'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full bg-[var(--bg-primary)]">
      <SettingsSidebar />
      <div className="flex-1 overflow-y-auto p-6">
        {children}
      </div>
    </div>
  )
}
