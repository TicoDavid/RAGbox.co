'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useVaultStore } from '@/stores/vaultStore'
import { usePrivilegeStore } from '@/stores/privilegeStore'
import { GlobalHeader } from './GlobalHeader'
import { VaultPanel } from './vault/VaultPanel'
import { VaultExplorer } from './vault/VaultExplorer'
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
  Info,
  Shield,
  Download,
  FileText,
} from 'lucide-react'
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
  const selectedDoc = selectedItemId ? documents[selectedItemId] : null

  if (!selectedDoc) {
    return (
      <div className="h-full flex flex-col">
        <div className="shrink-0 px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Inspector</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <Info className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">Select a document</p>
            <p className="text-xs text-slate-600 mt-1">to view details</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="shrink-0 px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Inspector</h3>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5 text-center">
          <FileText className="w-12 h-12 text-[var(--brand-blue)] mx-auto mb-2" />
          <p className="text-sm font-medium text-white truncate">{selectedDoc.name}</p>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-2 border-b border-white/5">
            <span className="text-slate-500">Size</span>
            <span className="text-slate-300">{((selectedDoc.size ?? 0) / 1024).toFixed(1)} KB</span>
          </div>
          <div className="flex justify-between py-2 border-b border-white/5">
            <span className="text-slate-500">Modified</span>
            <span className="text-slate-300">{new Date(selectedDoc.updatedAt).toLocaleDateString()}</span>
          </div>
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
// MAIN DASHBOARD LAYOUT
// ============================================================================

export function DashboardLayout() {
  // Store state
  const isVaultCollapsed = useVaultStore((s) => s.isCollapsed)
  const setVaultCollapsed = useVaultStore((s) => s.setCollapsed)
  const isExplorerMode = useVaultStore((s) => s.isExplorerMode)
  const fetchPrivilege = usePrivilegeStore((s) => s.fetch)
  const uploadDocument = useVaultStore((s) => s.uploadDocument)

  // Rail state
  const [leftExpanded, setLeftExpanded] = useState(!isVaultCollapsed)
  const [leftTab, setLeftTab] = useState<LeftRailTab>('vault')
  const [rightExpanded, setRightExpanded] = useState(false)
  const [rightTab, setRightTab] = useState<RightRailTab>('inspector')
  const [isIngestionOpen, setIsIngestionOpen] = useState(false)

  // Sync with vault store
  useEffect(() => {
    setLeftExpanded(!isVaultCollapsed)
  }, [isVaultCollapsed])

  useEffect(() => {
    fetchPrivilege()
  }, [fetchPrivilege])

  // Handlers
  const handleLeftTabClick = (tab: LeftRailTab) => {
    if (leftExpanded && leftTab === tab) {
      // Already on this tab, collapse
      setLeftExpanded(false)
      setVaultCollapsed(true)
    } else {
      // Open to this tab
      setLeftTab(tab)
      setLeftExpanded(true)
      setVaultCollapsed(false)
    }
  }

  const handleRightTabClick = (tab: RightRailTab) => {
    if (rightExpanded && rightTab === tab) {
      // Already on this tab, collapse
      setRightExpanded(false)
    } else {
      // Open to this tab
      setRightTab(tab)
      setRightExpanded(true)
    }
  }

  const handleIngestionUpload = async (files: File[]) => {
    for (const file of files) {
      await uploadDocument(file)
    }
    setIsIngestionOpen(false)
  }

  // Widths
  const RAIL_WIDTH = 64
  const LEFT_PANEL_WIDTH = 320
  const RIGHT_PANEL_WIDTH = 300

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

  // Explorer mode takes full width
  if (isExplorerMode) {
    return (
      <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-jakarta">
        <GlobalHeader />
        <div className="flex-1 overflow-hidden">
          <VaultExplorer />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden font-jakarta">
      <GlobalHeader />

      <div className="flex-1 flex overflow-hidden">
        {/* ============================================ */}
        {/* LEFT SIDE: Rail + Panel */}
        {/* ============================================ */}
        <div className="flex shrink-0">
          {/* Icon Rail */}
          <div style={{ width: RAIL_WIDTH }} className="shrink-0">
            <LeftStealthRail
              isExpanded={leftExpanded}
              activeTab={leftExpanded ? leftTab : null}
              onTabClick={handleLeftTabClick}
              onAddClick={() => setIsIngestionOpen(true)}
              onCollapse={() => {
                setLeftExpanded(false)
                setVaultCollapsed(true)
              }}
            />
          </div>

          {/* Expandable Panel */}
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
        </div>

        {/* ============================================ */}
        {/* CENTER: Mercury (Chat) */}
        {/* ============================================ */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <MercuryPanel />
        </div>

        {/* ============================================ */}
        {/* RIGHT SIDE: Panel + Rail */}
        {/* ============================================ */}
        <div className="flex shrink-0">
          {/* Expandable Panel */}
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

          {/* Icon Rail */}
          <div style={{ width: RAIL_WIDTH }} className="shrink-0">
            <RightStealthRail
              isExpanded={rightExpanded}
              activeTab={rightExpanded ? rightTab : null}
              onTabClick={handleRightTabClick}
              onCollapse={() => setRightExpanded(false)}
            />
          </div>
        </div>
      </div>

      {/* Ingestion Modal */}
      <IngestionModal
        isOpen={isIngestionOpen}
        onClose={() => setIsIngestionOpen(false)}
        onFileUpload={handleIngestionUpload}
      />

    </div>
  )
}
