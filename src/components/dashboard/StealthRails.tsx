'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Box,
  PlusCircle,
  Clock,
  Star,
  Sparkles,
  Scale,
  Download,
  ChevronLeft,
  ChevronRight,
  Mic,
  Maximize2,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

export type LeftRailTab = 'vault' | 'recent' | 'starred'
export type RightRailTab = 'mercury' | 'studio' | 'audit' | 'export'

interface RailIconProps {
  icon: React.ElementType
  label: string
  isActive?: boolean
  onClick: () => void
  side: 'left' | 'right'
  badge?: number
}

// ============================================================================
// RAIL ICON COMPONENT
// ============================================================================

function RailIcon({ icon: Icon, label, isActive, onClick, side, badge }: RailIconProps) {
  return (
    <div className={`relative group rail-icon-glow rounded-xl ${isActive ? 'rail-active' : ''}`}>
      <button
        onClick={onClick}
        aria-label={label}
        className={`
          relative w-11 h-11 flex items-center justify-center rounded-xl
          transition-all duration-200
          ${isActive
            ? 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)]'
            : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50'
          }
        `}
      >
        {/* Power Line indicator - active state */}
        {isActive && (
          <div
            className={`absolute top-1 bottom-1 w-0.5 bg-[var(--brand-blue)] rounded-full
              ${side === 'left' ? 'left-0' : 'right-0'}
            `}
          />
        )}
        <Icon className="w-5 h-5" />
        {badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center bg-[var(--danger)] text-[var(--text-primary)] text-[10px] font-bold rounded-full px-1">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </button>

      {/* Tooltip */}
      <div
        className={`
          absolute top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg
          bg-[var(--bg-primary)]/95 backdrop-blur-sm border border-[var(--border-default)] shadow-xl
          text-xs font-medium text-[var(--text-primary)] whitespace-nowrap
          opacity-0 pointer-events-none group-hover:opacity-100
          transition-opacity duration-200 z-50
          ${side === 'left' ? 'left-full ml-2' : 'right-full mr-2'}
        `}
      >
        {label}
      </div>
    </div>
  )
}

// ============================================================================
// LEFT RAIL (VAULT NAVIGATION)
// ============================================================================

interface LeftRailProps {
  isExpanded: boolean
  activeTab: LeftRailTab | null
  onTabClick: (tab: LeftRailTab) => void
  onAddClick: () => void
  onCollapse: () => void
  onExpandVault?: () => void
}

export function LeftStealthRail({
  isExpanded,
  activeTab,
  onTabClick,
  onAddClick,
  onCollapse,
  onExpandVault,
}: LeftRailProps) {
  const isVaultActive = isExpanded && activeTab === 'vault'

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] border-r border-[var(--border-default)]" role="navigation" aria-label="Vault navigation">
      {/* Icon Stack */}
      <div className="flex-1 flex flex-col items-center py-4 gap-2">
        {/* Vault - with expand functionality */}
        <div className="relative group">
          <button
            onClick={() => onTabClick('vault')}
            onDoubleClick={() => onExpandVault?.()}
            aria-label="Vault"
            className={`
              relative w-11 h-11 flex items-center justify-center rounded-xl
              transition-all duration-200
              ${isVaultActive
                ? 'bg-[var(--brand-blue)]/15 text-[var(--brand-blue)]'
                : 'text-[var(--brand-blue-hover)] hover:text-[var(--text-primary)] hover:bg-[var(--brand-blue)]/10'
              }
            `}
          >
            {isVaultActive && (
              <div className="absolute top-1 bottom-1 left-0 w-0.5 bg-[var(--brand-blue)] rounded-full" />
            )}
            <Box className="w-5 h-5" />
          </button>

          {/* Tooltip */}
          <div className="absolute top-1/2 -translate-y-1/2 left-full ml-2 px-2.5 py-1.5 rounded-lg
                        bg-[var(--bg-primary)]/95 backdrop-blur-sm border border-[var(--border-default)] shadow-xl
                        text-xs font-medium text-[var(--text-primary)] whitespace-nowrap
                        opacity-0 pointer-events-none group-hover:opacity-100
                        transition-opacity duration-200 z-50">
            {isVaultActive ? 'Double-click to expand' : 'Vault'}
          </div>
        </div>

        {/* Expand Vault Button - shown when vault is active */}
        {isVaultActive && onExpandVault && (
          <button
            onClick={onExpandVault}
            className="w-9 h-9 flex items-center justify-center rounded-lg
                       text-[var(--brand-blue)] hover:text-[var(--brand-blue-hover)] hover:bg-[var(--brand-blue)]/10
                       border border-[var(--brand-blue)]/30 hover:border-[var(--brand-blue)]/50
                       transition-all duration-200 group relative"
            title="Expand to Sovereign Explorer"
            aria-label="Expand to Sovereign Explorer"
          >
            <Maximize2 className="w-4 h-4" />
            {/* Tooltip */}
            <div className="absolute top-1/2 -translate-y-1/2 left-full ml-2 px-2.5 py-1.5 rounded-lg
                          bg-[var(--bg-primary)]/95 backdrop-blur-sm border border-[var(--border-default)] shadow-xl
                          text-xs font-medium text-[var(--text-primary)] whitespace-nowrap
                          opacity-0 pointer-events-none group-hover:opacity-100
                          transition-opacity duration-200 z-50">
              Sovereign Explorer
            </div>
          </button>
        )}

        {/* Add Data */}
        <RailIcon
          icon={PlusCircle}
          label="Add to Vault"
          onClick={onAddClick}
          side="left"
        />

        {/* Recent */}
        <RailIcon
          icon={Clock}
          label="Recent Files"
          isActive={isExpanded && activeTab === 'recent'}
          onClick={() => onTabClick('recent')}
          side="left"
        />

        {/* Starred */}
        <RailIcon
          icon={Star}
          label="Starred"
          isActive={isExpanded && activeTab === 'starred'}
          onClick={() => onTabClick('starred')}
          side="left"
        />
      </div>

      {/* Collapse Toggle (shown when expanded) */}
      {isExpanded && (
        <div className="pb-4 flex justify-center">
          <button
            onClick={onCollapse}
            aria-label="Collapse left panel"
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50
                       transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// RIGHT RAIL (STUDIO/INSPECTOR)
// ============================================================================

interface RightRailProps {
  isExpanded: boolean
  activeTab: RightRailTab | null
  onTabClick: (tab: RightRailTab) => void
  onCollapse: () => void
}

export function RightStealthRail({
  isExpanded,
  activeTab,
  onTabClick,
  onCollapse,
}: RightRailProps) {
  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] border-l border-[var(--border-default)]" role="navigation" aria-label="Tools navigation">
      {/* Icon Stack */}
      <div className="flex-1 flex flex-col items-center py-4 gap-2">
        {/* Mercury Voice Agent */}
        <RailIcon
          icon={Mic}
          label="Mercury"
          isActive={isExpanded && activeTab === 'mercury'}
          onClick={() => onTabClick('mercury')}
          side="right"
        />

        {/* Studio/Create */}
        <RailIcon
          icon={Sparkles}
          label="Studio"
          isActive={isExpanded && activeTab === 'studio'}
          onClick={() => onTabClick('studio')}
          side="right"
        />

        {/* Truth & Audit */}
        <RailIcon
          icon={Scale}
          label="Truth & Audit"
          isActive={isExpanded && activeTab === 'audit'}
          onClick={() => onTabClick('audit')}
          side="right"
        />

        {/* Export */}
        <RailIcon
          icon={Download}
          label="Export"
          isActive={isExpanded && activeTab === 'export'}
          onClick={() => onTabClick('export')}
          side="right"
        />
      </div>

      {/* Collapse Toggle (shown when expanded) */}
      {isExpanded && (
        <div className="pb-4 flex justify-center">
          <button
            onClick={onCollapse}
            aria-label="Collapse right panel"
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50
                       transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// RAIL PANEL WRAPPER (Animated container for expanded content)
// ============================================================================

interface RailPanelProps {
  isOpen: boolean
  side: 'left' | 'right'
  width: number
  children: React.ReactNode
}

export function RailPanel({ isOpen, side, width, children }: RailPanelProps) {
  return (
    <motion.div
      initial={false}
      animate={{ width: isOpen ? width : 0 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={`
        overflow-hidden bg-[var(--bg-secondary)]
        ${side === 'left' ? 'border-r' : 'border-l'} border-[var(--border-subtle)]
      `}
    >
      <div style={{ width }} className="h-full">
        {children}
      </div>
    </motion.div>
  )
}
