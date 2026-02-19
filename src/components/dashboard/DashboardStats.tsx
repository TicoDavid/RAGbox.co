'use client'

import React, { useEffect, useState } from 'react'
import { FileText, Search, Shield, Database } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface VaultStats {
  documentCount: number
  chunkCount: number
  queryCount: number
  privilegedCount: number
}

export function DashboardStats() {
  const [stats, setStats] = useState<VaultStats | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch('/api/documents')
        if (res.ok) {
          const data = await res.json()
          const docs = data.documents || data.data?.documents || []
          const total = data.total ?? data.data?.total ?? docs.length
          const privileged = docs.filter((d: { privilegeLevel?: string }) => d.privilegeLevel === 'privileged').length

          // Get chunk count from documents
          const chunks = docs.reduce((sum: number, d: { chunkCount?: number }) => sum + (d.chunkCount || 0), 0)

          setStats({
            documentCount: total,
            chunkCount: chunks,
            queryCount: 0,
            privilegedCount: privileged,
          })
        }
      } catch {
        // Silent fail — widget is non-critical
      }
    }
    load()
  }, [])

  const items = [
    {
      icon: FileText,
      label: 'Documents',
      value: stats?.documentCount ?? '-',
      color: 'text-[var(--brand-blue)]',
    },
    {
      icon: Database,
      label: 'Chunks',
      value: stats?.chunkCount ?? '-',
      color: 'text-[var(--success)]',
    },
    {
      icon: Shield,
      label: 'Privileged',
      value: stats?.privilegedCount ?? '-',
      color: 'text-[var(--warning)]',
    },
    {
      icon: Search,
      label: 'Queries',
      value: stats?.queryCount ?? '-',
      color: 'text-[var(--text-accent)]',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 p-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg
                     bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)]"
        >
          <item.icon className={`w-4 h-4 ${item.color} shrink-0`} />
          <div className="min-w-0">
            <p className="text-base font-semibold text-[var(--text-primary)] leading-tight">
              {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
            </p>
            <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
