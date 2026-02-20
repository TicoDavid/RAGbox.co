'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useVaultStore } from '@/stores/vaultStore'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import { useIsDesktop, useIsTablet } from '@/hooks/useMediaQuery'
import { GlobalHeader } from './GlobalHeader'
import { VaultPanel } from './vault/VaultPanel'
import { SovereignExplorer } from './vault/explorer'
import { MercuryWindow } from './mercury/MercuryWindow'
import { isMercuryEnabled } from '@/lib/features'
import { CenterChat } from './chat'
import { SovereignStudio } from './studio'
import { useContentIntelligenceStore } from '@/stores/contentIntelligenceStore'
import {
  RightStealthRail,
  type LeftRailTab,
  type RightRailTab,
} from './StealthRails'
import { Sidebar } from '@/components/Sidebar'
import {
  Star,
  Shield,
  FileText,
  Menu,
  X,
  Wrench,
} from 'lucide-react'
import IngestionModal from '@/app/dashboard/components/IngestionModal'
import { apiFetch } from '@/lib/api'
import { ExportPanel } from './export'

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
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Recent Files</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {recentDocs.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-tertiary)] text-sm">
            No recent files
          </div>
        ) : (
          <div className="space-y-1">
            {recentDocs.map((doc) => (
              <button
                key={doc.id}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg
                         text-left text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50 transition-colors"
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
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider">Starred</h3>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <Star className="w-12 h-12 text-[var(--warning)]/30 mx-auto mb-3" />
          <p className="text-sm text-[var(--text-tertiary)]">No starred documents</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Star important files for quick access</p>
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
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
          <Shield className="w-4 h-4 text-[var(--success)]" />
          Audit Log
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {entries.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)] text-center py-4">No audit entries yet</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="p-3 rounded-lg bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--success)]">{formatAction(entry.action)}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{formatTime(entry.createdAt)}</span>
                </div>
                {entry.resourceId && (
                  <p className="text-xs text-[var(--text-secondary)] truncate">{entry.resourceId}</p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ExportPanel extracted to ./export/ExportPanel.tsx

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
              ${side === 'left' ? 'left-0 border-r' : 'right-0 border-l'} border-[var(--border-default)]`}
          >
            {/* Close button */}
            <div className={`absolute top-3 z-10 ${side === 'left' ? 'right-3' : 'left-3'}`}>
              <button
                onClick={onClose}
                aria-label="Close panel"
                className="w-9 h-9 flex items-center justify-center rounded-lg
                           text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]
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
                    bg-[var(--bg-secondary)] border-b border-[var(--border-subtle)]">
      <button
        onClick={onLeftOpen}
        aria-label="Open vault menu"
        className="w-10 h-10 flex items-center justify-center rounded-xl
                   text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]
                   transition-colors"
      >
        <Menu className="w-5 h-5" />
      </button>

      <span className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
        Mercury
      </span>

      <button
        onClick={onRightOpen}
        aria-label="Open tools menu"
        className="w-10 h-10 flex items-center justify-center rounded-xl
                   text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]
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
  const pathname = usePathname()

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

  // Rail state
  const [leftExpanded, setLeftExpanded] = useState(!isVaultCollapsed)
  const [leftTab, setLeftTab] = useState<LeftRailTab>('vault')
  const [rightExpanded, setRightExpanded] = useState(false)
  const [rightTab, setRightTab] = useState<RightRailTab>('studio')
  const mercuryEnabled = isMercuryEnabled()
  const [mercuryOpen, setMercuryOpen] = useState(mercuryEnabled)
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
    // Mercury has its own dedicated panel on desktop — skip tool panel logic
    if (tab === 'mercury') {
      if (isTablet && !isDesktop) {
        setRightTab('mercury')
        setMobileRightOpen(true)
      }
      // On desktop, Mercury is handled by handleMercuryToggle
      return
    }

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


  const handleIngestionUpload = async (files: File[]) => {
    await uploadDocuments(files)
    setIsIngestionOpen(false)
  }

  // Sidebar navigation — maps sidebar item clicks to panel toggles
  const handleSidebarNavigate = useCallback((itemId: string) => {
    if (isMobile) {
      setMobileLeftOpen(false)
    }

    switch (itemId) {
      case 'box':
        handleLeftTabClick('vault')
        break
      case 'audit':
        if (isMobile) {
          setRightTab('audit')
          setMobileRightOpen(true)
        } else {
          handleRightTabClick('audit')
        }
        break
    }
  }, [isMobile, handleLeftTabClick, handleRightTabClick])

  // Active panel for Sidebar highlight
  const sidebarActivePanel = useMemo(() => {
    if (pathname?.startsWith('/dashboard/agents')) return null // agent uses pathname
    if (rightExpanded && rightTab === 'audit') return 'audit'
    return 'box'
  }, [pathname, rightExpanded, rightTab])

  // Auto-open panel from URL query param (e.g., /dashboard?panel=audit)
  const didAutoOpenPanel = useRef(false)
  useEffect(() => {
    if (didAutoOpenPanel.current) return
    const params = new URLSearchParams(window.location.search)
    const panel = params.get('panel')
    if (panel) {
      didAutoOpenPanel.current = true
      if (panel === 'audit') handleRightTabClick('audit')
      window.history.replaceState({}, '', '/dashboard')
    }
  }, [handleRightTabClick])

  // Mercury toggle
  const handleMercuryToggle = useCallback(() => {
    setMercuryOpen((prev) => !prev)
  }, [])

  // Widths
  const RAIL_WIDTH = 64
  const LEFT_PANEL_WIDTH = 420
  const RIGHT_PANEL_WIDTH = 380
  const MERCURY_PANEL_WIDTH = 400

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

  // Render right tool panel content (Studio/Audit/Export — overlays center)
  const renderToolContent = () => {
    switch (rightTab) {
      case 'studio':
        return <SovereignStudio />
      case 'audit':
        return <AuditPanel />
      case 'export':
        return <ExportPanel />
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
        {/* LEFT SIDE: Sidebar + Vault Panel (hidden on mobile) */}
        {/* ============================================ */}
        {isTablet && (
          <div className="flex shrink-0">
            <Sidebar
              onNavigate={handleSidebarNavigate}
              activePanelId={sidebarActivePanel}
            />
            {/* Expandable vault panel (desktop only) */}
            {isDesktop && (
              <motion.div
                initial={false}
                animate={{ width: leftExpanded ? LEFT_PANEL_WIDTH : 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden border-r border-[var(--border-subtle)]"
              >
                <div style={{ width: LEFT_PANEL_WIDTH }} className="h-full bg-[var(--bg-secondary)]">
                  {renderLeftContent()}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* CENTER: Document Workspace + Tool Overlay */}
        {/* ============================================ */}
        <div className="flex-1 min-w-0 overflow-hidden relative">
          <CenterChat />

          {/* Tool panel overlay (Studio/Audit/Export) slides over center */}
          {isDesktop && (
            <AnimatePresence>
              {rightExpanded && (
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  className="absolute top-0 right-0 bottom-0 z-20 border-l border-[var(--border-subtle)]"
                  style={{ width: RIGHT_PANEL_WIDTH }}
                >
                  <div className="h-full bg-[var(--bg-secondary)]">
                    {renderToolContent()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* ============================================ */}
        {/* RIGHT SIDE: Mercury Panel + Rail (hidden on mobile) */}
        {/* ============================================ */}
        {isTablet && (
          <div className="flex shrink-0">
            {/* Mercury — persistent right panel (desktop, paid feature) */}
            {isDesktop && mercuryEnabled && (
              <motion.div
                initial={false}
                animate={{ width: mercuryOpen ? MERCURY_PANEL_WIDTH : 0 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="overflow-hidden border-l border-[var(--border-subtle)]"
              >
                <div style={{ width: MERCURY_PANEL_WIDTH }} className="h-full bg-[var(--bg-secondary)]">
                  <MercuryWindow />
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
                isMercuryOpen={mercuryEnabled && mercuryOpen}
                onMercuryToggle={mercuryEnabled ? handleMercuryToggle : undefined}
                mercuryEnabled={mercuryEnabled}
              />
            </div>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* MOBILE OVERLAYS */}
      {/* ============================================ */}

      {/* Left overlay: navigation + panel content */}
      <MobileOverlay
        isOpen={mobileLeftOpen}
        onClose={() => setMobileLeftOpen(false)}
        side="left"
      >
        {isMobile ? (
          /* Mobile: show Sidebar navigation (not visible inline) */
          <Sidebar
            onNavigate={handleSidebarNavigate}
            activePanelId={sidebarActivePanel}
          />
        ) : (
          /* Tablet: Sidebar is visible inline, show vault panel content */
          <div className="h-full bg-[var(--bg-secondary)]">
            {renderLeftContent()}
          </div>
        )}
      </MobileOverlay>

      {/* Right overlay: Mercury or tool panel (mobile/tablet) */}
      <MobileOverlay
        isOpen={mobileRightOpen}
        onClose={() => setMobileRightOpen(false)}
        side="right"
      >
        <div className="flex h-full">
          {/* Panel content — Mercury if mercury tab, else tool panel */}
          <div className="flex-1 min-w-0 bg-[var(--bg-secondary)]">
            {rightTab === 'mercury' && mercuryEnabled ? <MercuryWindow /> : renderToolContent()}
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
              isMercuryOpen={rightTab === 'mercury'}
              onMercuryToggle={() => setRightTab('mercury')}
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
