'use client'

import SettingsSidebar from '@/components/settings/SettingsSidebar'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full dark:bg-void bg-slate-50">
      <SettingsSidebar />
      <div className="flex-1 overflow-y-auto p-6">
        {children}
      </div>
    </div>
  )
}
