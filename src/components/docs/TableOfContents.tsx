'use client'

import { useState, useEffect } from 'react'

interface TocEntry {
  id: string
  text: string
  level: number
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function extractHeadings(markdown: string): TocEntry[] {
  const entries: TocEntry[] = []
  const lines = markdown.split('\n')
  let inCodeBlock = false

  for (const line of lines) {
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }
    if (inCodeBlock) continue

    const match = line.match(/^(#{2,3})\s+(.+)/)
    if (match) {
      const text = match[2].replace(/\*\*/g, '').replace(/`/g, '')
      entries.push({
        id: slugify(text),
        text,
        level: match[1].length,
      })
    }
  }
  return entries
}

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
