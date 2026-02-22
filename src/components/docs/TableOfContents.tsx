'use client'

import { useState, useEffect } from 'react'
import type { TocEntry } from '@/lib/docs'

export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (obs) => {
        for (const entry of obs) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    )

    for (const { id } of entries) {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [entries])

  if (entries.length < 3) return null

  return (
    <nav className="space-y-0.5">
      <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
        On this page
      </p>
      {entries.map((entry) => (
        <a
          key={entry.id}
          href={`#${entry.id}`}
          className={`block text-xs py-1 transition-colors ${
            entry.level === 3 ? 'pl-3' : ''
          } ${
            activeId === entry.id
              ? 'text-[var(--brand-blue)] font-medium'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
          }`}
        >
          {entry.text}
        </a>
      ))}
    </nav>
  )
}
