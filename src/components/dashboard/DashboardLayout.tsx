'use client'

import React, { useEffect } from 'react'
import { useVaultStore } from '@/stores/vaultStore'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import { GlobalHeader } from './GlobalHeader'
import { VaultPanel } from './vault/VaultPanel'
import { MercuryPanel } from './mercury/MercuryPanel'
import { ForgePanel } from './forge/ForgePanel'

export function DashboardLayout() {
  const isVaultCollapsed = useVaultStore((s) => s.isCollapsed)
  const fetchPrivilege = usePrivilegeStore((s) => s.fetch)

  useEffect(() => {
    fetchPrivilege()
  }, [fetchPrivilege])

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-jakarta">
      <GlobalHeader />

      <div
        className="flex-1 flex overflow-hidden"
        style={{
          gridTemplateColumns: `${isVaultCollapsed ? 'var(--rail-width)' : 'var(--vault-expanded-width)'} 1fr var(--rail-width)`,
          transition: 'grid-template-columns var(--transition-normal)',
        }}
      >
        {/* Left: Vault */}
        <div
          className="shrink-0 border-r border-[var(--border-default)] overflow-hidden"
          style={{
            width: isVaultCollapsed ? 'var(--rail-width)' : 'var(--vault-expanded-width)',
            transition: 'width var(--transition-normal)',
          }}
        >
          <VaultPanel />
        </div>

        {/* Center: Mercury */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <MercuryPanel />
        </div>

        {/* Right: Forge */}
        <div
          className="shrink-0 border-l border-[var(--border-default)] overflow-hidden"
          style={{ width: 'var(--rail-width)' }}
        >
          <ForgePanel />
        </div>
      </div>
    </div>
  )
}
