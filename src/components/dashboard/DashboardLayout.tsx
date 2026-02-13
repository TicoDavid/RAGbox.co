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
  Trash2,
  Clock,
  MessageSquare,
} from 'lucide-react'
import { SovereignCertificate } from './vault/SovereignCertificate'
import IngestionModal from '@/app/dashboard/components/IngestionModal'

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

function InspectorPanel() {
  const selectedItemId = useVaultStore((s) => s.selectedItemId)
  const documents = useVaultStore((s) => s.documents)
  const deleteDocument = useVaultStore((s) => s.deleteDocument)
  const togglePrivilege = useVaultStore((s) => s.togglePrivilege)
  const toggleStar = useVaultStore((s) => s.toggleStar)
  const selectAndChat = useVaultStore((s) => s.selectAndChat)
  const selectedDoc = selectedItemId ? documents[selectedItemId] : null

  // Calculate vault stats
  const docList = Object.values(documents)
  const totalDocs = docList.length
  const totalSize = docList.reduce((acc, d) => acc + (d.size || 0), 0)
  const formattedSize = totalSize > 1024 * 1024
    ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
    : `${(totalSize / 1024).toFixed(1)} KB`

  if (!selectedDoc) {
    return (
      <div className="h-full flex flex-col">
        <div className="shrink-0 px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Inspector</h3>
        </div>
        <div className="flex-1 p-4">
          {/* Vault Vitals Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/5 border border-emerald-500/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Vault Vitals</p>
                <p className="text-xs text-emerald-400">System Secure</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs text-slate-400">Total Files</span>
                <span className="text-sm font-medium text-white">{totalDocs}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-xs text-slate-400">Storage Used</span>
                <span className="text-sm font-medium text-white">{formattedSize}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-slate-400">Security</span>
                <span className="text-[10px] font-medium text-amber-500/70 uppercase tracking-wider">Secured</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 text-center mt-4">
            Select a document to inspect
          </p>
        </div>
      </div>
    )
  }

  const formatSize = (bytes?: number): string => {
    if (!bytes) return '\u2014'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (date: Date): string =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Inspector</h3>
        <button
          onClick={() => toggleStar(selectedDoc.id)}
          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          aria-label={selectedDoc.isStarred ? 'Unstar document' : 'Star document'}
        >
          <Star className={`w-4 h-4 ${selectedDoc.isStarred ? 'fill-amber-400 text-amber-400' : 'text-slate-500'}`} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* File Header */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-[80px] h-[96px] rounded-lg bg-[#0a0f18] border border-white/10 flex items-center justify-center shadow-[0_0_30px_-10px_rgba(0,0,0,0.5)]">
            <FileText className="w-8 h-8 text-slate-500" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white break-all leading-tight">{selectedDoc.name}</p>
            <p className="text-[11px] text-slate-500 mt-1 font-mono">
              {formatSize(selectedDoc.size)} · {selectedDoc.mimeType?.split('/')[1]?.toUpperCase() || 'FILE'}
            </p>
          </div>
        </div>

        {/* Sovereign Certificate */}
        <SovereignCertificate document={selectedDoc} />

        {/* Privilege Badge */}
        {selectedDoc.isPrivileged && (
          <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-red-950/30 border border-red-500/20">
            <Shield className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">
              Attorney-Client Privilege
            </span>
          </div>
        )}

        {/* Timestamp */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-600">
          <Clock className="w-3 h-3" />
          <span>Deposited {formatDate(selectedDoc.createdAt)}</span>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-auto pt-2">
          <button
            onClick={() => selectAndChat(selectedDoc.id)}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--brand-blue)] text-white text-sm font-semibold hover:bg-[var(--brand-blue-hover)] transition-colors"
            aria-label={`Chat with ${selectedDoc.name}`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat with this File
          </button>
          <button
            onClick={() => togglePrivilege(selectedDoc.id)}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-white/10 text-sm text-slate-400 hover:text-white hover:bg-white/5 hover:border-white/20 transition-all"
            aria-label={selectedDoc.isPrivileged ? `Remove privilege from ${selectedDoc.name}` : `Mark ${selectedDoc.name} as privileged`}
          >
            <Shield className="w-4 h-4" />
            {selectedDoc.isPrivileged ? 'Remove Privilege' : 'Mark Privileged'}
          </button>
          <button
            onClick={() => deleteDocument(selectedDoc.id)}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-red-500/20 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-950/30 hover:border-red-500/30 transition-all"
            aria-label={`Delete ${selectedDoc.name}`}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
function AuditPanel() {
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
          {[
            { time: '2m ago', action: 'Queried document', doc: 'Contract_v2.pdf' },
            { time: '5m ago', action: 'Opened vault', doc: null },
            { time: '12m ago', action: 'Uploaded file', doc: 'Financial_Report.xlsx' },
            { time: '1h ago', action: 'Changed security', doc: 'NDA_Acme.pdf' },
          ].map((entry, i) => (
            <div key={i} className="p-3 rounded-lg bg-slate-900/50 border border-white/5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-emerald-400">{entry.action}</span>
                <span className="text-[10px] text-slate-600">{entry.time}</span>
              </div>
              {entry.doc && (
                <p className="text-xs text-slate-400 truncate">{entry.doc}</p>
              )}
            </div>
          ))}
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
  const uploadDocument = useVaultStore((s) => s.uploadDocument)
  const selectedItemId = useVaultStore((s) => s.selectedItemId)

  // Rail state
  const [leftExpanded, setLeftExpanded] = useState(!isVaultCollapsed)
  const [leftTab, setLeftTab] = useState<LeftRailTab>('vault')
  const [rightExpanded, setRightExpanded] = useState(false)
  const [rightTab, setRightTab] = useState<RightRailTab>('inspector')
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

  // Auto-open inspector panel when a file is selected
  useEffect(() => {
    if (selectedItemId && isDesktop) {
      setRightTab('inspector')
      setRightExpanded(true)
    } else if (!selectedItemId && rightTab === 'inspector') {
      setRightExpanded(false)
    }
  }, [selectedItemId, isDesktop, rightTab])

  useEffect(() => {
    fetchPrivilege()
  }, [fetchPrivilege])

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

  const handleIngestionUpload = async (files: File[]) => {
    for (const file of files) {
      await uploadDocument(file)
    }
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
      case 'inspector':
        return <InspectorPanel />
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
