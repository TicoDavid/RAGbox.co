'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useVaultStore } from '@/stores/vaultStore'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import { useIsDesktop, useIsTablet } from '@/hooks/useMediaQuery'
import { GlobalHeader } from './GlobalHeader'
import { VaultPanel } from './vault/VaultPanel'
import { SovereignExplorer } from './vault/explorer'
import { MercuryPanel } from './mercury/MercuryPanel'
import { MercuryVoicePanel } from './mercury/MercuryVoicePanel'
import { SovereignStudio } from './studio'
import { IntelligencePanel } from './intelligence'
import { WhatsAppPanel } from './whatsapp/WhatsAppPanel'
import { useContentIntelligenceStore } from '@/stores/contentIntelligenceStore'
import { useWhatsAppStore } from '@/stores/whatsappStore'
import {
  LeftStealthRail,
  RightStealthRail,
  type LeftRailTab,
  type RightRailTab,
} from './StealthRails'
import {
  Star,
  Shield,
  Download,
  FileText,
  Menu,
  X,
  Wrench,
} from 'lucide-react'
import IngestionModal from '@/app/dashboard/components/IngestionModal'
import { apiFetch } from '@/lib/api'

// ============================================================================
// PANEL CONTENT COMPONENTS
// ============================================================================

function RecentFilesPanel() {
  const documents = useVaultStore((s) => s.documents)
  const recentDocs = Object.values(documents)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10)

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Recent Files</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {recentDocs.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            No recent files
          </div>
        ) : (
          <div className="space-y-1">
            {recentDocs.map((doc) => (
              <button
                key={doc.id}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg
                         text-left text-sm text-slate-300 hover:bg-white/5 transition-colors"
              >
                <FileText className="w-4 h-4 text-[var(--brand-blue)] shrink-0" />
                <span className="truncate">{doc.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StarredPanel() {
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Starred</h3>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <Star className="w-12 h-12 text-amber-400/30 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No starred documents</p>
          <p className="text-xs text-slate-600 mt-1">Star important files for quick access</p>
        </div>
      </div>
    </div>
  )
}

function AuditPanel() {
  const [entries, setEntries] = useState<Array<{ id: string; action: string; createdAt: string; resourceId?: string }>>([])

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch('/api/audit/entries?limit=10')
        if (res.ok) {
          const data = await res.json()
          setEntries(data.data?.entries || [])
        }
      } catch {
        // Silent — fallback to empty
      }
    }
    load()
  }, [])

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  const formatAction = (action: string) =>
    action.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Audit Log
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">No audit entries yet</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="p-3 rounded-lg bg-slate-900/50 border border-white/5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-emerald-400">{formatAction(entry.action)}</span>
                  <span className="text-[10px] text-slate-600">{formatTime(entry.createdAt)}</span>
                </div>
                {entry.resourceId && (
                  <p className="text-xs text-slate-400 truncate">{entry.resourceId}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function ExportPanel() {
  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Export</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {[
          { label: 'Export Conversation', desc: 'Download as PDF or Markdown' },
          { label: 'Export Audit Trail', desc: 'Compliance-ready log file' },
          { label: 'Export Vault Data', desc: 'Full data package (GDPR)' },
        ].map((item) => (
          <button
            key={item.label}
            className="w-full flex items-center gap-3 p-3 rounded-xl
                     bg-slate-900/50 border border-white/5 hover:border-blue-500/30
                     hover:bg-blue-500/5 transition-all text-left"
          >
            <Download className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-sm font-medium text-white">{item.label}</p>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// MOBILE OVERLAY COMPONENT
// ============================================================================

interface MobileOverlayProps {
  isOpen: boolean
  onClose: () => void
  side: 'left' | 'right'
  children: React.ReactNode
}

function MobileOverlay({ isOpen, onClose, side, children }: MobileOverlayProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: side === 'left' ? '-100%' : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: side === 'left' ? '-100%' : '100%' }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className={`fixed top-0 bottom-0 z-50 w-[85vw] max-w-[400px]
              bg-[var(--bg-secondary)] shadow-2xl
              ${side === 'left' ? 'left-0 border-r' : 'right-0 border-l'} border-white/10`}
          >
            {/* Close button */}
            <div className={`absolute top-3 z-10 ${side === 'left' ? 'right-3' : 'left-3'}`}>
              <button
                onClick={onClose}
                aria-label="Close panel"
                className="w-9 h-9 flex items-center justify-center rounded-lg
                           text-slate-400 hover:text-white hover:bg-white/10
                           transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="h-full overflow-y-auto">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ============================================================================
// MOBILE TOOLBAR (hamburger + tools buttons shown only on mobile)
// ============================================================================

interface MobileToolbarProps {
  onLeftOpen: () => void
  onRightOpen: () => void
}

function MobileToolbar({ onLeftOpen, onRightOpen }: MobileToolbarProps) {
  return (
    <div className="flex md:hidden items-center justify-between px-3 py-2
                    bg-[var(--bg-secondary)] border-b border-white/5">
      <button
        onClick={onLeftOpen}
        aria-label="Open vault menu"
        className="w-10 h-10 flex items-center justify-center rounded-xl
                   text-slate-400 hover:text-white hover:bg-white/10
                   transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Mercury
      </span>

      <button
        onClick={onRightOpen}
        aria-label="Open tools menu"
        className="w-10 h-10 flex items-center justify-center rounded-xl
                   text-slate-400 hover:text-white hover:bg-white/10
                   transition-colors"
      >
        <Wrench className="w-5 h-5" />
      </button>
    </div>
  )
}

// ============================================================================
// MAIN DASHBOARD LAYOUT
// ============================================================================

export function DashboardLayout() {
  // Responsive breakpoints
  const isDesktop = useIsDesktop()   // >= 1024px
  const isTablet = useIsTablet()     // >= 768px
  const isMobile = !isTablet         // < 768px

  // Store state
  const isVaultCollapsed = useVaultStore((s) => s.isCollapsed)
  const setVaultCollapsed = useVaultStore((s) => s.setCollapsed)
  const isExplorerMode = useVaultStore((s) => s.isExplorerMode)
  const toggleExplorerMode = useVaultStore((s) => s.toggleExplorerMode)
  const fetchPrivilege = usePrivilegeStore((s) => s.fetch)
  const gapSummary = useContentIntelligenceStore((s) => s.gapSummary)
  const fetchGapSummary = useContentIntelligenceStore((s) => s.fetchGapSummary)
  const uploadDocuments = useVaultStore((s) => s.uploadDocuments)
  const totalUnread = useWhatsAppStore((s) => s.totalUnread)

  // Rail state
  const [leftExpanded, setLeftExpanded] = useState(!isVaultCollapsed)
  const [leftTab, setLeftTab] = useState<LeftRailTab>('vault')
  const [rightExpanded, setRightExpanded] = useState(false)
  const [rightTab, setRightTab] = useState<RightRailTab>('studio')
  const [isIngestionOpen, setIsIngestionOpen] = useState(false)

  // Mobile overlay state
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false)
  const [mobileRightOpen, setMobileRightOpen] = useState(false)

  // Close mobile overlays when transitioning to tablet/desktop
  useEffect(() => {
    if (isTablet) {
      setMobileLeftOpen(false)
      setMobileRightOpen(false)
    }
  }, [isTablet])

  // On tablet (not desktop), force panels collapsed — icon-only rails
  useEffect(() => {
    if (isTablet && !isDesktop) {
      setLeftExpanded(false)
      setRightExpanded(false)
    }
  }, [isTablet, isDesktop])

  // Sync with vault store
  useEffect(() => {
    setLeftExpanded(!isVaultCollapsed)
  }, [isVaultCollapsed])

  useEffect(() => {
    fetchPrivilege()
  }, [fetchPrivilege])

  useEffect(() => {
    fetchGapSummary()
  }, [fetchGapSummary])

  // Handlers
  const handleLeftTabClick = useCallback((tab: LeftRailTab) => {
    // On tablet (not desktop), open as mobile overlay instead of inline expansion
    if (isTablet && !isDesktop) {
      setLeftTab(tab)
      setMobileLeftOpen(true)
      return
    }

    if (leftExpanded && leftTab === tab) {
      setLeftExpanded(false)
      setVaultCollapsed(true)
    } else {
      setLeftTab(tab)
      setLeftExpanded(true)
      setVaultCollapsed(false)
    }
  }, [isTablet, isDesktop, leftExpanded, leftTab, setVaultCollapsed])

  const handleRightTabClick = useCallback((tab: RightRailTab) => {
    // On tablet (not desktop), open as mobile overlay instead of inline expansion
    if (isTablet && !isDesktop) {
      setRightTab(tab)
      setMobileRightOpen(true)
      return
    }

    if (rightExpanded && rightTab === tab) {
      setRightExpanded(false)
    } else {
      setRightTab(tab)
      setRightExpanded(true)
    }
  }, [isTablet, isDesktop, rightExpanded, rightTab])

  // Listen for mercury:open-voice event from ContextBar phone button
  useEffect(() => {
    const handler = () => handleRightTabClick('mercury')
    window.addEventListener('mercury:open-voice', handler)
    return () => window.removeEventListener('mercury:open-voice', handler)
  }, [handleRightTabClick])

  const handleIngestionUpload = async (files: File[]) => {
    await uploadDocuments(files)
    setIsIngestionOpen(false)
  }

  // Widths
  const RAIL_WIDTH = 64
  const LEFT_PANEL_WIDTH = 420
  const RIGHT_PANEL_WIDTH = 380

  // Render left panel content based on tab
  const renderLeftContent = () => {
    switch (leftTab) {
      case 'vault':
        return <VaultPanel />
      case 'recent':
        return <RecentFilesPanel />
      case 'starred':
        return <StarredPanel />
      default:
        return null
    }
  }

  // Render right panel content based on tab
  const renderRightContent = () => {
    switch (rightTab) {
      case 'mercury':
        return <MercuryVoicePanel />
      case 'studio':
        return <SovereignStudio />
      case 'audit':
        return <AuditPanel />
      case 'export':
        return <ExportPanel />
      case 'intelligence':
        return <IntelligencePanel />
      case 'whatsapp':
        return <WhatsAppPanel />
      default:
        return null
    }
  }

  // Explorer mode takes full width - The Sovereign Explorer
  if (isExplorerMode) {
    return (
      <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-jakarta">
        <GlobalHeader />
        <div className="flex-1 overflow-hidden">
          <SovereignExplorer onClose={() => useVaultStore.getState().exitExplorerMode()} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-jakarta">
      <GlobalHeader />

      {/* Mobile toolbar — hamburger + tools buttons (visible < 768px) */}
      {isMobile && (
        <MobileToolbar
          onLeftOpen={() => setMobileLeftOpen(true)}
          onRightOpen={() => setMobileRightOpen(true)}
        />
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* ============================================ */}
        {/* LEFT SIDE: Rail + Panel (hidden on mobile) */}
        {/* ============================================ */}
        {isTablet && (
          <div className="flex shrink-0">
            {/* Icon Rail */}
            <div style={{ width: RAIL_WIDTH }} className="shrink-0">
              <LeftStealthRail
                isExpanded={isDesktop && leftExpanded}
                activeTab={isDesktop && leftExpanded ? leftTab : null}
                onTabClick={handleLeftTabClick}
                onAddClick={() => setIsIngestionOpen(true)}
                onCollapse={() => {
                  setLeftExpanded(false)
                  setVaultCollapsed(true)
                }}
                onExpandVault={toggleExplorerMode}
              />
            </div>

            {/* Expandable Panel (only on desktop) */}
            {isDesktop && (
              <motion.div
                initial={false}
                animate={{ width: leftExpanded ? LEFT_PANEL_WIDTH : 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden border-r border-white/5"
              >
                <div style={{ width: LEFT_PANEL_WIDTH }} className="h-full bg-[var(--bg-secondary)]">
                  {renderLeftContent()}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* CENTER: Mercury (Chat) — always visible */}
        {/* ============================================ */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <MercuryPanel />
        </div>

        {/* ============================================ */}
        {/* RIGHT SIDE: Panel + Rail (hidden on mobile) */}
        {/* ============================================ */}
        {isTablet && (
          <div className="flex shrink-0">
            {/* Expandable Panel (only on desktop) */}
            {isDesktop && (
              <motion.div
                initial={false}
                animate={{ width: rightExpanded ? RIGHT_PANEL_WIDTH : 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden border-l border-white/5"
              >
                <div style={{ width: RIGHT_PANEL_WIDTH }} className="h-full bg-[var(--bg-secondary)]">
                  {renderRightContent()}
                </div>
              </motion.div>
            )}

            {/* Icon Rail */}
            <div style={{ width: RAIL_WIDTH }} className="shrink-0">
              <RightStealthRail
                isExpanded={isDesktop && rightExpanded}
                activeTab={isDesktop && rightExpanded ? rightTab : null}
                onTabClick={handleRightTabClick}
                onCollapse={() => setRightExpanded(false)}
                intelligenceBadge={gapSummary?.openGaps}
                whatsappBadge={totalUnread}
              />
            </div>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* MOBILE OVERLAYS */}
      {/* ============================================ */}

      {/* Left overlay: Vault navigation + panel content */}
      <MobileOverlay
        isOpen={mobileLeftOpen}
        onClose={() => setMobileLeftOpen(false)}
        side="left"
      >
        <div className="flex h-full">
          {/* Rail icons */}
          <div style={{ width: RAIL_WIDTH }} className="shrink-0">
            <LeftStealthRail
              isExpanded={true}
              activeTab={leftTab}
              onTabClick={(tab) => {
                setLeftTab(tab)
              }}
              onAddClick={() => {
                setMobileLeftOpen(false)
                setIsIngestionOpen(true)
              }}
              onCollapse={() => setMobileLeftOpen(false)}
              onExpandVault={() => {
                setMobileLeftOpen(false)
                toggleExplorerMode()
              }}
            />
          </div>

          {/* Panel content */}
          <div className="flex-1 min-w-0 bg-[var(--bg-secondary)]">
            {renderLeftContent()}
          </div>
        </div>
      </MobileOverlay>

      {/* Right overlay: Tools navigation + panel content */}
      <MobileOverlay
        isOpen={mobileRightOpen}
        onClose={() => setMobileRightOpen(false)}
        side="right"
      >
        <div className="flex h-full">
          {/* Panel content */}
          <div className="flex-1 min-w-0 bg-[var(--bg-secondary)]">
            {renderRightContent()}
          </div>

          {/* Rail icons */}
          <div style={{ width: RAIL_WIDTH }} className="shrink-0">
            <RightStealthRail
              isExpanded={true}
              activeTab={rightTab}
              onTabClick={(tab) => {
                setRightTab(tab)
              }}
              onCollapse={() => setMobileRightOpen(false)}
              whatsappBadge={totalUnread}
            />
          </div>
        </div>
      </MobileOverlay>

      {/* Ingestion Modal */}
      <IngestionModal
        isOpen={isIngestionOpen}
        onClose={() => setIsIngestionOpen(false)}
        onFileUpload={handleIngestionUpload}
      />

    </div>
  )
}
