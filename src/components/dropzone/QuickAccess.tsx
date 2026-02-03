'use client'

import { Clock, Star, Users } from 'lucide-react'

interface QuickAccessProps {
  recentCount: number
  favoritesCount: number
  sharedCount: number
  activeSection: 'recent' | 'favorites' | 'shared' | null
  onSelect: (section: 'recent' | 'favorites' | 'shared' | null) => void
}

export default function QuickAccess({
  recentCount,
  favoritesCount,
  sharedCount,
  activeSection,
  onSelect,
}: QuickAccessProps) {
  const items = [
    { id: 'recent' as const, icon: Clock, label: 'Recent', count: recentCount },
    { id: 'favorites' as const, icon: Star, label: 'Favorites', count: favoritesCount },
    { id: 'shared' as const, icon: Users, label: 'Shared', count: sharedCount },
  ]

  return (
    <div className="px-2 py-1.5">
      <span className="text-[10px] font-semibold text-[#888] uppercase tracking-wider px-1">
        Quick Access
      </span>
      <div className="mt-1 space-y-0.5">
        {items.map(({ id, icon: Icon, label, count }) => (
          <button
            key={id}
            onClick={() => onSelect(activeSection === id ? null : id)}
            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs transition-colors ${
              activeSection === id
                ? 'bg-[#2463EB]/10 text-[#2463EB]'
                : 'text-[#888] hover:text-white hover:bg-[#111]'
            }`}
          >
            <Icon size={14} />
            <span className="flex-1 text-left">{label}</span>
            <span className="text-[10px] text-[#555]">{count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
