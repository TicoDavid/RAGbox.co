'use client'

interface SettingItemProps {
  label: string
  description?: string
  children: React.ReactNode
}

export default function SettingItem({ label, description, children }: SettingItemProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#222]">
      <div>
        <div className="text-xs font-medium text-white">{label}</div>
        {description && (
          <div className="text-[10px] text-[#666] mt-0.5">{description}</div>
        )}
      </div>
      <div>{children}</div>
    </div>
  )
}
