'use client'

import React, { useEffect } from 'react'
import { useVaultStore } from '@/stores/vaultStore'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import { GlobalHeader } from './GlobalHeader'
import { VaultPanel } from './vault/VaultPanel'
import { VaultExplorer } from './vault/VaultExplorer'
import { MercuryPanel } from './mercury/MercuryPanel'
import { ForgePanel } from './forge/ForgePanel'

export function DashboardLayout() {
  const isVaultCollapsed = useVaultStore((s) => s.isCollapsed)
  const isExplorerMode = useVaultStore((s) => s.isExplorerMode)
  const fetchPrivilege = usePrivilegeStore((s) => s.fetch)

  useEffect(() => {
    fetchPrivilege()
  }, [fetchPrivilege])

  // Calculate vault width based on state
  const getVaultWidth = () => {
    if (isExplorerMode) return '80%' // Full explorer mode
    if (isVaultCollapsed) return 'var(--rail-width)' // Icon rail (56px)
    return 'var(--vault-expanded-width)' // Quick list (400px)
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-jakarta">
      <GlobalHeader />

      <div className="flex-1 flex overflow-hidden relative">
        {/* Left: Vault - Dynamic Width */}
        <div
          className="shrink-0 border-r border-[var(--border-default)] overflow-hidden transition-all duration-300 ease-in-out"
          style={{ width: getVaultWidth() }}
        >
          {isExplorerMode ? <VaultExplorer /> : <VaultPanel />}
        </div>

        {/* Center: Mercury - Flex to fill remaining space */}
        <div
          className={`flex-1 min-w-0 overflow-hidden transition-all duration-300 ease-in-out ${
            isExplorerMode ? 'opacity-50 pointer-events-none' : 'opacity-100'
          }`}
        >
          <MercuryPanel />
        </div>

        {/* Right: Forge - Collapsible */}
        <div
          className="shrink-0 border-l border-[var(--border-default)] overflow-hidden transition-all duration-300 ease-in-out"
          style={{ width: isExplorerMode ? '0' : 'var(--rail-width)' }}
        >
          <ForgePanel />
        </div>

        {/* Explorer Mode Overlay - Click to collapse */}
        {isExplorerMode && (
          <div
            className="absolute inset-0 bg-black/20 pointer-events-none"
            style={{ left: '80%' }}
          />
        )}
      </div>
    </div>
  )
}
