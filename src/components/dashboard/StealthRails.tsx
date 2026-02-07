'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Box,
  PlusCircle,
  Clock,
  Star,
  Info,
  Sparkles,
  Shield,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

// ============================================================================
// TYPES
// ============================================================================

export type LeftRailTab = 'vault' | 'recent' | 'starred'
export type RightRailTab = 'inspector' | 'studio' | 'audit' | 'export'

interface RailIconProps {
  icon: React.ElementType
  label: string
  isActive?: boolean
  onClick: () => void
  side: 'left' | 'right'
}

// ============================================================================
// RAIL ICON COMPONENT
// ============================================================================

function RailIcon({ icon: Icon, label, isActive, onClick, side }: RailIconProps) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`
          w-11 h-11 flex items-center justify-center rounded-xl
          transition-all duration-200
          ${isActive
            ? 'bg-[var(--brand-blue)]/20 text-[var(--brand-blue)] shadow-[0_0_15px_rgba(36,99,235,0.3)]'
            : 'text-slate-500 hover:text-white hover:bg-white/5'
          }
        `}
      >
        <Icon className="w-5 h-5" />
      </button>

      {/* Tooltip */}
      <div
        className={`
          absolute top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg
          bg-[#0A192F] border border-white/10 shadow-xl
          text-xs font-medium text-white whitespace-nowrap
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
}

export function LeftStealthRail({
  isExpanded,
  activeTab,
  onTabClick,
  onAddClick,
  onCollapse,
}: LeftRailProps) {
  return (
    <div className="h-full flex flex-col bg-[#0A192F] border-r border-white/10">
      {/* Icon Stack */}
      <div className="flex-1 flex flex-col items-center py-4 gap-2">
        {/* Vault */}
        <RailIcon
          icon={Box}
          label="Vault"
          isActive={isExpanded && activeTab === 'vault'}
          onClick={() => onTabClick('vault')}
          side="left"
        />

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
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-slate-500 hover:text-white hover:bg-white/5
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
    <div className="h-full flex flex-col bg-[#0A192F] border-l border-white/10">
      {/* Icon Stack */}
      <div className="flex-1 flex flex-col items-center py-4 gap-2">
        {/* Inspector */}
        <RailIcon
          icon={Info}
          label="Inspector"
          isActive={isExpanded && activeTab === 'inspector'}
          onClick={() => onTabClick('inspector')}
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

        {/* Audit Log */}
        <RailIcon
          icon={Shield}
          label="Audit Log"
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
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-slate-500 hover:text-white hover:bg-white/5
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
        ${side === 'left' ? 'border-r' : 'border-l'} border-white/5
      `}
    >
      <div style={{ width }} className="h-full">
        {children}
      </div>
    </motion.div>
  )
}
